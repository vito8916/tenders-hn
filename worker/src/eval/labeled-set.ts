// Loads the labeled set and rebuilds the population it was drawn from, for
// the harness arms, and runs the retrieval methods the pools were built from.
// The labels come from production, so the arms run there.
import { readFile } from "node:fs/promises";
import { embed, embedMany } from "ai";
import type { Pool } from "pg";
import { EMBEDDING_DIMENSIONS } from "@/lib/ai/models";
import { EXTRACTION_VERSION, type LineOfBusiness } from "../matching/profile";
import { fuseCandidates, retrieveCandidates, retrieveForLines } from "../matching/retrieve";
import type { Label, LabeledProcess, PoolItem } from "./retrieval";

export interface Profile {
    key: string;
    name: string;
    description: string;
    // Concrete examples of what the company offers; retrieval searches for them as terms.
    offerings: string[];
    unspsc: string[];
}

// Labeled sets live in labeled-set/<version>/. v1 (29 Sep 2026): narrow
// profiles, relevant / not relevant. v2: corporate-purpose profiles labeled
// core / adjacent / not relevant.
export type LabeledSetVersion = "v1" | "v2";

export interface Pools {
    generatedAt: string;
    profiles: Record<string, { population: number; notRetrieved: number; sampleWeight: number; items: PoolItem[] }>;
}

export const LABEL_VIEWS = ["relevant", "core", "blind"] as const;
export type LabelView = (typeof LABEL_VIEWS)[number];

type V2Label = "core" | "adjacent" | "not_relevant" | "unsure";
interface V2LabeledProcess {
    processId: string;
    expediente: string;
    label: V2Label;
    firstLabel?: V2Label;
    note?: string;
}

const viewLabel = (item: V2LabeledProcess, view: LabelView): Label => {
    const label = view === "blind" ? (item.firstLabel ?? item.label) : item.label;
    if (label === "core") return "relevant";
    if (label === "adjacent") return view === "core" ? "unsure" : "relevant";
    return label;
};

export const labeledSetUrl = (version: LabeledSetVersion) => new URL(`./labeled-set/${version}/`, import.meta.url);
const readJson = async <T>(version: LabeledSetVersion, file: string): Promise<T> =>
    JSON.parse(await readFile(new URL(file, labeledSetUrl(version)), "utf8"));

// v1 profiles named their offerings `terms`.
export const loadProfiles = async (version: LabeledSetVersion) =>
    (await readJson<(Profile & { terms?: string[] })[]>(version, "profiles.json")).map(({ terms, ...profile }) => ({
        ...profile,
        offerings: profile.offerings ?? terms ?? [],
    }));

/** Profiles, pools, and the labels per profile in each view. */
export async function loadLabeledSet(version: LabeledSetVersion) {
    const [profiles, pools, { profiles: stored }] = await Promise.all([
        loadProfiles(version),
        readJson<Pools>(version, "pools.json"),
        readJson<{ profiles: Record<string, LabeledProcess[] | V2LabeledProcess[]> }>(version, "labels.json"),
    ]);
    const inView = (view: LabelView): Record<string, LabeledProcess[]> =>
        version === "v1"
            ? (stored as Record<string, LabeledProcess[]>)
            : Object.fromEntries(
                  Object.entries(stored as Record<string, V2LabeledProcess[]>).map(([profile, items]) => [
                      profile,
                      items.map((item) => ({ processId: item.processId, expediente: item.expediente, label: viewLabel(item, view) })),
                  ]),
              );
    const labels = Object.fromEntries(LABEL_VIEWS.map((view) => [view, inView(view)])) as Record<LabelView, Record<string, LabeledProcess[]>>;
    return { profiles, pools, labels };
}

export type ExtractedLine = LineOfBusiness & { unspscClasses: { code: string }[] };

/** Lines of business of each profile's extracted profile (labeled-set/<version>/extracted-profiles-<extraction version>.json). */
export async function loadExtractedLines(version: LabeledSetVersion) {
    const file = `extracted-profiles-${EXTRACTION_VERSION}.json`;
    const { profiles } = await readJson<{ profiles: Record<string, { profile: { linesOfBusiness: ExtractedLine[] } }> }>(version, file).catch(() => ({
        profiles: {},
    }));
    return { file, lines: Object.fromEntries(Object.entries(profiles).map(([key, { profile }]) => [key, profile.linesOfBusiness])) };
}

/**
 * The processes open when the labeled set was drawn, plus every labeled
 * process (a closing date moved earlier must not drop a label).
 * Exits when the database does not hold the labeled processes or has no
 * embeddings for `model`.
 */
export async function loadPopulation(pool: Pool, pools: Pools, labels: Record<string, LabeledProcess[]>, model: string) {
    const labeledIds = [...new Set(Object.values(labels).flatMap((items) => items.map((item) => item.processId)))];
    const { rows } = await pool.query<{ id: string }>(
        `select id from public.procurement_processes
         where (first_seen_at <= $1 and (closes_at is null or closes_at > $1)) or id = any($2::uuid[])`,
        [pools.generatedAt, labeledIds],
    );
    const populationIds = rows.map((row) => row.id);

    const { rows: coverageRows } = await pool.query<{ embedded_processes: number; chunks: number }>(
        `select
           (select count(*)::int from public.procurement_processes where id = any($1::uuid[]) and object_embedding_model = $2) as embedded_processes,
           (select count(*)::int from public.document_chunks c
              join public.source_documents d on d.current_version_id = c.document_version_id
              where d.process_id = any($1::uuid[]) and c.embedding_model = $2) as chunks`,
        [populationIds, model],
    );
    const coverage = coverageRows[0];

    console.log(
        `Population: ${populationIds.length} processes (${pools.profiles[Object.keys(pools.profiles)[0]].population} when labeled). ` +
            `Model ${model}: ${coverage.embedded_processes} process objects and ${coverage.chunks} chunks embedded.`,
    );
    const populationIdSet = new Set(populationIds);
    if (labeledIds.some((id) => !populationIdSet.has(id)) || coverage.embedded_processes === 0) {
        console.error("This database does not hold the labeled population. Point DATABASE_URL at production.");
        process.exit(1);
    }

    return { populationIds, coverage };
}

export async function embedProfile(profile: Profile, model: string) {
    const { embedding } = await embed({
        model,
        value: profile.description,
        providerOptions: { voyage: { inputType: "query", outputDimension: EMBEDDING_DIMENSIONS } },
    });
    return embedding;
}

// How a profile becomes queries (see build-pools.ts):
//   whole       the whole text as one query, with the offerings as terms and the profile's codes
//   paragraphs  each paragraph as its own query, fused
//   profile     each line of business of the extracted profile, with its keywords as terms and its classes as codes, fused
export type RetrievalMethod = "whole" | "paragraphs" | "profile";
export interface Signals {
    terms: boolean;
    semantic: boolean;
    codes: boolean;
}
export const ALL_SIGNALS: Signals = { terms: true, semantic: true, codes: true };

/** Retrieval for one profile by one method within the population, best first. */
export async function retrieveByMethod(
    pool: Pool,
    {
        method,
        profile,
        lines,
        model,
        populationIds,
        signals = ALL_SIGNALS,
    }: { method: RetrievalMethod; profile: Profile; lines: ExtractedLine[]; model: string; populationIds: string[]; signals?: Signals },
) {
    if (method === "profile") {
        return retrieveForLines(pool, { lines, model, processIds: populationIds }, signals);
    }

    const embedQueries = async (values: string[]) =>
        signals.semantic
            ? (await embedMany({ model, values, providerOptions: { voyage: { inputType: "query", outputDimension: EMBEDDING_DIMENSIONS } } })).embeddings
            : values.map(() => null);
    const retrieve = (embedding: number[] | null, terms: string[], unspsc: string[]) =>
        retrieveCandidates(pool, {
            terms: signals.terms ? terms : [],
            model,
            embedding,
            unspsc: signals.codes ? unspsc : [],
            processIds: populationIds,
        });

    if (method === "whole") {
        const [embedding] = await embedQueries([profile.description]);
        return retrieve(embedding, profile.offerings, profile.unspsc);
    }

    const paragraphs = profile.description.split(/\n\s*\n/).filter((paragraph) => paragraph.trim());
    const embeddings = await embedQueries(paragraphs);
    const lists = [];
    for (const embedding of embeddings) {
        lists.push(await retrieve(embedding, profile.offerings, profile.unspsc));
    }
    return fuseCandidates(lists);
}
