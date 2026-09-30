// Candidate retrieval for a company profile: each line of business of the
// extracted profile is its own query (its text embedded, its keywords as
// terms, its UNSPSC classes as codes), and the lists are fused. The labeled-set
// evaluation chose this method (plan, Phase 3: v2 runs).
import { embedMany } from "ai";
import type { Pool } from "pg";
import { EMBEDDING_DIMENSIONS } from "@/lib/ai/models";
import type { RetrievedEvidence } from "@/lib/matching/reasons";
import type { LineOfBusiness } from "./profile";
import { lineQueryText } from "./unspsc";

export interface Candidate extends RetrievedEvidence {
    process_id: string;
    matched_terms: string[];
    matched_fields: string[];
    fragments: (RetrievedEvidence["fragments"][number] & { chunk_id: number })[];
}

export type RetrievalLine = Pick<LineOfBusiness, "name" | "description" | "keywords"> & { unspscClasses: { code: string }[] };

/**
 * One retrieve_candidates query, best first. Empty inputs switch a signal off.
 * @param processIds restricts retrieval to these processes, open or closed; null searches every open process
 */
export async function retrieveCandidates(
    pool: Pool,
    {
        terms,
        model,
        embedding,
        unspsc,
        processIds,
    }: { terms: string[]; model: string; embedding: number[] | null; unspsc: string[]; processIds: string[] | null },
) {
    const { rows } = await pool.query<Candidate>(
        `select process_id, matched_terms, matched_fields, field_terms, matched_unspsc, object_similarity, fragments
         from public.retrieve_candidates(
           search_terms => $1, model => $2, query_embedding => $3::extensions.halfvec,
           unspsc_prefixes => $4, open_only => $5::uuid[] is null, process_ids => $5::uuid[]
         )`,
        [terms, model, embedding && JSON.stringify(embedding), unspsc, processIds],
    );
    return rows;
}

/** Reciprocal-rank fusion of ranked lists, best first; a process found by several lists keeps all its matches. */
export function fuseCandidates(lists: Candidate[][]): Candidate[] {
    const fused = new Map<string, { candidate: Candidate; score: number }>();
    for (const list of lists) {
        for (const [index, candidate] of list.entries()) {
            const entry = fused.get(candidate.process_id);
            const score = 1 / (60 + index + 1);
            if (!entry) {
                fused.set(candidate.process_id, { candidate: { ...candidate, field_terms: { ...candidate.field_terms } }, score });
                continue;
            }
            const merged = entry.candidate;
            entry.score += score;
            merged.matched_terms = [...new Set([...merged.matched_terms, ...candidate.matched_terms])];
            merged.matched_fields = [...new Set([...merged.matched_fields, ...candidate.matched_fields])];
            merged.matched_unspsc = [...new Set([...merged.matched_unspsc, ...candidate.matched_unspsc])];
            for (const [field, terms] of Object.entries(candidate.field_terms) as [keyof Candidate["field_terms"], string[]][]) {
                merged.field_terms[field] = [...new Set([...(merged.field_terms[field] ?? []), ...terms])];
            }
            if (candidate.object_similarity !== null) {
                merged.object_similarity = Math.max(merged.object_similarity ?? candidate.object_similarity, candidate.object_similarity);
            }
            const chunkIds = new Set(merged.fragments.map((fragment) => fragment.chunk_id));
            merged.fragments = [...merged.fragments, ...candidate.fragments.filter((fragment) => !chunkIds.has(fragment.chunk_id))];
        }
    }
    return [...fused.values()].sort((a, b) => b.score - a.score).map((entry) => entry.candidate);
}

/** Retrieval for a profile's lines of business, fused, best first. */
export async function retrieveForLines(
    pool: Pool,
    { lines, model, processIds = null }: { lines: RetrievalLine[]; model: string; processIds?: string[] | null },
    signals = { terms: true, semantic: true, codes: true },
) {
    const queries = lines.map((line) => ({ text: lineQueryText(line), terms: line.keywords, unspsc: line.unspscClasses.map((item) => item.code) }));
    const embeddings = signals.semantic
        ? (
              await embedMany({
                  model,
                  values: queries.map((query) => query.text),
                  providerOptions: { voyage: { inputType: "query", outputDimension: EMBEDDING_DIMENSIONS } },
              })
          ).embeddings
        : queries.map(() => null);

    const lists = [];
    for (const [index, query] of queries.entries()) {
        lists.push(
            await retrieveCandidates(pool, {
                terms: signals.terms ? query.terms : [],
                model,
                embedding: embeddings[index],
                unspsc: signals.codes ? query.unspsc : [],
                processIds,
            }),
        );
    }
    return fuseCandidates(lists);
}
