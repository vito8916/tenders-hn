// Retrieval-only arm of the chat evaluation (plan §5.5, parked retrieval gap):
// for each question of the golden set with expected pages, where do those
// pages rank in retrieve_chat_passages' fusion, and how much text would the
// chat receive if it got more passages. No chat model is called; the query
// embeddings cost a fraction of a cent.
//
//   pnpm --filter worker eval:chat-retrieval [--set=v1]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { embed } from "ai";
import { Pool } from "pg";
import { z } from "zod";
import { EMBEDDING_DIMENSIONS, modelForRole } from "@/lib/ai/models";
import { REPORT_PROCESSES } from "@/features/chat/prompt";
import { env } from "../env";

const argument = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const set = argument("set") ?? "v1";
const CUTOFFS = [12, 16, 20, 24, 30, 40];
// retrieve_chat_passages keeps the top 40 of each list before fusing them.
const LIST_LIMIT = 40;
const RRF_K = 60;

const questionSchema = z.object({
    processId: z.uuid().optional(),
    runId: z.uuid().optional(),
    expediente: z.string(),
    question: z.string(),
    kind: z.string(),
    expectedPages: z.array(z.object({ document: z.string(), pages: z.array(z.number().int()) })),
});

const questions = z.array(questionSchema).parse(JSON.parse(await readFile(new URL(`./chat-set/${set}.json`, import.meta.url), "utf8")));
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 2 });
const embedModel = modelForRole("embed");

async function contextProcesses(question: z.infer<typeof questionSchema>) {
    if (question.processId) return [question.processId];
    const { rows } = await pool.query(
        `select m.process_id from public.search_run_matches m
         where m.run_id = $1 and m.relevance in ('muy_relevante', 'posible')
         order by m.relevance = 'muy_relevante' desc, m.retrieval_rank limit $2`,
        [question.runId, REPORT_PROCESSES],
    );
    return rows.map((row) => row.process_id as string);
}

async function queryEmbedding(text: string) {
    const { embedding } = await embed({
        model: embedModel,
        value: text,
        providerOptions: { voyage: { inputType: "query", outputDimension: EMBEDDING_DIMENSIONS } },
    });
    return embedding;
}

// Every chunk of the context with its rank in each list, uncapped, so ranks past 40 show too.
async function rankedChunks(processIds: string[], text: string, embedding: number[]) {
    const { rows } = await pool.query(
        `with chunks as (
           select c.id, c.embedding, c.tsv, d.title, c.page_start, c.page_end, length(c.content) as chars
           from public.source_documents d
           join public.document_chunks c on c.document_version_id = d.current_version_id and c.embedding_model = $4
           where d.process_id = any ($1) and d.removed_at is null
         ),
         question as (
           select nullif(replace(plainto_tsquery('spanish'::regconfig, private.immutable_unaccent($2))::text, '&', '|'), '')::tsquery as tq
         ),
         -- Rare words weigh more: BM25's idf over the context's chunks, ignoring term frequency.
         terms as (
           select distinct t.lexeme
           from unnest(to_tsvector('spanish'::regconfig, private.immutable_unaccent($2))) t
         ),
         idf as (
           select t.lexeme,
                  ln(1 + ((select count(*) from chunks) - count(c.id) + 0.5) / (count(c.id) + 0.5)) as weight
           from terms t left join chunks c on t.lexeme = any (tsvector_to_array(c.tsv))
           group by t.lexeme
         ),
         weighted as (
           select c.id, sum(i.weight) as score
           from chunks c join idf i on i.lexeme = any (tsvector_to_array(c.tsv))
           group by c.id
         )
         select c.id, c.title, c.page_start, c.page_end, c.chars,
                row_number() over (order by c.embedding operator(extensions.<=>) $3::extensions.halfvec) as semantic_rank,
                case when q.tq is not null and c.tsv @@ q.tq
                     then rank() over (order by (q.tq is not null and c.tsv @@ q.tq) desc, ts_rank_cd(c.tsv, q.tq) desc) end as lexical_rank,
                case when w.score is not null then rank() over (order by w.score desc nulls last) end as idf_rank
         from chunks c cross join question q left join weighted w on w.id = c.id`,
        [processIds, text, JSON.stringify(embedding), embedModel],
    );
    const reciprocal = (rank: number | null) => (rank !== null && rank <= LIST_LIMIT ? 1 / (RRF_K + rank) : 0);
    const chunks = rows.map((row) => ({
        id: Number(row.id),
        title: row.title as string,
        pageStart: row.page_start as number,
        pageEnd: row.page_end as number,
        chars: Number(row.chars),
        semanticRank: Number(row.semantic_rank),
        lexicalRank: row.lexical_rank === null ? null : Number(row.lexical_rank),
        idfRank: row.idf_rank === null ? null : Number(row.idf_rank),
    }));
    const fusedRanks = (lexical: Array<"lexicalRank" | "idfRank">) => {
        const scored = chunks
            .map((chunk) => ({ id: chunk.id, score: reciprocal(chunk.semanticRank) + lexical.reduce((sum, key) => sum + reciprocal(chunk[key]), 0) }))
            .sort((a, b) => b.score - a.score || a.id - b.id);
        return new Map(scored.map((chunk, index) => [chunk.id, chunk.score > 0 ? index + 1 : null]));
    };
    const today = fusedRanks(["lexicalRank"]);
    const weighted = fusedRanks(["idfRank"]);
    const both = fusedRanks(["lexicalRank", "idfRank"]);
    return chunks
        .map((chunk) => ({ ...chunk, fusedRank: today.get(chunk.id) ?? null, idfFusedRank: weighted.get(chunk.id) ?? null, bothFusedRank: both.get(chunk.id) ?? null }))
        .sort((a, b) => (a.fusedRank ?? Infinity) - (b.fusedRank ?? Infinity));
}

async function measure(question: z.infer<typeof questionSchema>) {
    const processIds = await contextProcesses(question);
    const embedding = await queryEmbedding(question.question);
    const chunks = await rankedChunks(processIds, question.question, embedding);
    // What the app's function returns, which may differ from the exact ranks above.
    const { rows: returned } = await pool.query(
        `select chunk_id from public.retrieve_chat_passages($1, $2, $3::extensions.halfvec, $4, $5)`,
        [processIds, question.question, JSON.stringify(embedding), embedModel, LIST_LIMIT],
    );
    const functionRank = new Map(returned.map((row, index) => [Number(row.chunk_id), index + 1]));
    const expected = chunks.filter((chunk) =>
        question.expectedPages.some(
            (entry) => entry.document === chunk.title && entry.pages.some((page) => page >= chunk.pageStart && page <= chunk.pageEnd),
        ),
    );
    const best = (candidates: typeof chunks, key: "fusedRank" | "idfFusedRank" | "bothFusedRank" | "semanticRank" | "lexicalRank" | "idfRank") =>
        candidates.reduce<number | null>((min, chunk) => (chunk[key] !== null && (min === null || chunk[key] < min) ? chunk[key] : min), null);
    // Each expected page on its own: an answer needs every one, not just the best ranked.
    const pages = question.expectedPages.flatMap((entry) =>
        entry.pages.map((page) => {
            const covering = chunks.filter((chunk) => chunk.title === entry.document && page >= chunk.pageStart && page <= chunk.pageEnd);
            const inFunction = covering.flatMap((chunk) => functionRank.get(chunk.id) ?? []);
            return { document: entry.document, page, functionRank: inFunction.length > 0 ? Math.min(...inFunction) : null, fusedRank: best(covering, "fusedRank"), idfFusedRank: best(covering, "idfFusedRank"), bothFusedRank: best(covering, "bothFusedRank"), idfRank: best(covering, "idfRank"), semanticRank: best(covering, "semanticRank"), lexicalRank: best(covering, "lexicalRank") };
        }),
    );
    return {
        expediente: question.expediente,
        kind: question.kind,
        question: question.question,
        processes: processIds.length,
        chunks: chunks.length,
        expectedChunks: expected.length,
        fusedRank: best(expected, "fusedRank"),
        pages,
        charsAt: Object.fromEntries(CUTOFFS.map((cutoff) => [cutoff, chunks.slice(0, cutoff).reduce((sum, chunk) => sum + chunk.chars, 0)])),
    };
}

const results: Array<Awaited<ReturnType<typeof measure>>> = [];
for (const question of questions.filter((item) => item.expectedPages.length > 0)) results.push(await measure(question));
await pool.end();

console.table(
    results.map((result) => ({
        expediente: result.expediente,
        kind: result.kind,
        chunks: result.chunks,
        expected: result.expectedChunks,
        bestPage: result.fusedRank ?? "—",
        functionRank: result.pages.map((page) => `p${page.page}:${page.functionRank ?? "—"}`).join(" "),
        withIdf: result.pages.map((page) => `p${page.page}:${page.idfFusedRank ?? "—"}`).join(" "),
        withBoth: result.pages.map((page) => `p${page.page}:${page.bothFusedRank ?? "—"}`).join(" "),
        everyPage: result.pages.map((page) => `p${page.page}:${page.fusedRank ?? `—(s${page.semanticRank},l${page.lexicalRank ?? "—"})`}`).join(" "),
        question: result.question.slice(0, 60),
    })),
);
const summary = CUTOFFS.map((cutoff) => ({
    passages: cutoff,
    anyPage: `${results.filter((result) => result.fusedRank !== null && result.fusedRank <= cutoff).length}/${results.length}`,
    everyPage: `${results.filter((result) => result.pages.every((page) => page.fusedRank !== null && page.fusedRank <= cutoff)).length}/${results.length}`,
    pages: `${results.flatMap((result) => result.pages).filter((page) => page.fusedRank !== null && page.fusedRank <= cutoff).length}/${results.flatMap((result) => result.pages).length}`,
    everyPageIdf: `${results.filter((result) => result.pages.every((page) => page.idfFusedRank !== null && page.idfFusedRank <= cutoff)).length}/${results.length}`,
    everyPageBoth: `${results.filter((result) => result.pages.every((page) => page.bothFusedRank !== null && page.bothFusedRank <= cutoff)).length}/${results.length}`,
    pagesBoth: `${results.flatMap((result) => result.pages).filter((page) => page.bothFusedRank !== null && page.bothFusedRank <= cutoff).length}/${results.flatMap((result) => result.pages).length}`,
    pagesIdf: `${results.flatMap((result) => result.pages).filter((page) => page.idfFusedRank !== null && page.idfFusedRank <= cutoff).length}/${results.flatMap((result) => result.pages).length}`,
    medianChars: results.map((result) => result.charsAt[cutoff]).sort((a, b) => a - b)[Math.floor(results.length / 2)],
}));
console.table(summary);

await mkdir(new URL("./results/", import.meta.url), { recursive: true });
const file = new URL(`./results/chat-retrieval-${new Date().toISOString().slice(0, 10)}-${set}.json`, import.meta.url);
await writeFile(file, `${JSON.stringify({ set, embedModel, summary, results }, null, 2)}\n`);
console.log(`Report: ${file.pathname}`);
