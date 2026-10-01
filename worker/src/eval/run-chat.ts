// Chat evaluation (plan §5.5): each candidate model answers the golden set
// of Spanish questions over real processes, with the same retrieval, sources,
// prompt, and citation validation as the app (features/chat). The report
// keeps every answer with automatic metrics (citation validity, expected
// pages cited, whether retrieval found them, latency, tokens, cost); answer
// correctness, refusals, and Spanish are judged by reading it.
//
//   pnpm --filter worker eval:chat [--set=v1] [--models=openai/gpt-6-luna,deepseek/deepseek-v4.1-flash] [--concurrency=3]
//
// Every answer is a paid call through the AI Gateway: confirm the estimate first.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { embed, generateText } from "ai";
import { Pool } from "pg";
import { z } from "zod";
import { CHAT_MODEL_CANDIDATES, EMBEDDING_DIMENSIONS, modelForRole } from "@/lib/ai/models";
import { validateCitations } from "@/features/chat/citations";
import {
    buildPrompt,
    buildSources,
    documentReadability,
    MAX_OUTPUT_TOKENS,
    MAX_PASSAGES,
    REPORT_PROCESSES,
    type ContextProcess,
    type Passage,
} from "@/features/chat/prompt";
import { processDetailSchema, sourceDocumentSchema } from "@/features/opportunities/schemas";
import { RelevanceSchema } from "@/features/search-runs/schemas";
import { env } from "../env";
import { errorMessage } from "../log";

const argument = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const set = argument("set") ?? "v1";
const models = (argument("models") ?? CHAT_MODEL_CANDIDATES.join(",")).split(",").map((model) => model.trim());
const concurrency = Number(argument("concurrency") ?? 3);

const questionSchema = z.object({
    processId: z.uuid().optional(),
    runId: z.uuid().optional(),
    expediente: z.string(),
    question: z.string(),
    kind: z.enum(["factual", "absent", "eligibility", "unread", "no_documents", "report"]),
    expectedFacts: z.array(z.string()),
    expectedPages: z.array(z.object({ document: z.string(), pages: z.array(z.number().int()) })),
    evidence: z.string(),
    notes: z.string(),
});
type Question = z.infer<typeof questionSchema>;

const questions = z.array(questionSchema).parse(JSON.parse(await readFile(new URL(`./chat-set/${set}.json`, import.meta.url), "utf8")));
const pool = new Pool({ connectionString: env.DATABASE_URL, max: concurrency + 1 });
const embedModel = modelForRole("embed");

// Gateway prices in US$ per token, to report the cost of each answer.
const pricing = new Map(
    z
        .object({ data: z.array(z.object({ id: z.string(), pricing: z.object({ input: z.string(), output: z.string() }).partial().optional() })) })
        .parse(await (await fetch("https://ai-gateway.vercel.sh/v1/models")).json())
        .data.map((model) => [model.id, { input: Number(model.pricing?.input ?? 0), output: Number(model.pricing?.output ?? 0) }]),
);

/** The context's processes as the app loads them (features/chat/repository.ts), as the postgres role. */
async function loadProcesses(processIds: string[], snapshots: Map<string, ContextProcess["snapshot"]>): Promise<ContextProcess[]> {
    const { rows: processes } = await pool.query(
        `select p.id, p.expediente, p.title, p.buyer_entity, p.modality, p.stage, p.closes_at, p.detail_url, v.detail
         from public.procurement_processes p left join public.process_versions v on v.id = p.current_version_id
         where p.id = any ($1)`,
        [processIds],
    );
    const { rows: documents } = await pool.query(
        `select d.process_id, d.title, d.kind, d.download_error, dv.extraction_status
         from public.source_documents d left join public.document_versions dv on dv.id = d.current_version_id
         where d.process_id = any ($1) and d.removed_at is null
         order by d.first_seen_at`,
        [processIds],
    );
    return processIds.flatMap((processId) => {
        const process = processes.find((row) => row.id === processId);
        if (!process) return [];
        return {
            processId,
            expediente: process.expediente,
            title: process.title,
            buyerEntity: process.buyer_entity,
            modality: process.modality,
            stage: process.stage,
            closesAt: process.closes_at?.toISOString() ?? null,
            detailUrl: process.detail_url,
            detail: process.detail ? processDetailSchema.parse(process.detail) : null,
            documents: documents
                .filter((document) => document.process_id === processId)
                .map((document) => ({
                    title: document.title,
                    kind: sourceDocumentSchema.shape.kind.parse(document.kind),
                    readability: documentReadability(document.extraction_status, document.download_error),
                })),
            snapshot: snapshots.get(processId) ?? null,
        };
    });
}

async function loadContext(question: Question) {
    if (question.processId) return { processes: await loadProcesses([question.processId], new Map()), isReport: false };

    const { rows } = await pool.query(
        `select m.process_id, m.stage, m.closes_at, m.relevance, r.created_at
         from public.search_run_matches m join public.search_runs r on r.id = m.run_id
         where m.run_id = $1 and m.relevance in ('muy_relevante', 'posible')
         order by m.relevance = 'muy_relevante' desc, m.retrieval_rank
         limit $2`,
        [question.runId, REPORT_PROCESSES],
    );
    const snapshots = new Map(
        rows.map((row) => [
            row.process_id as string,
            { stage: row.stage, closesAt: row.closes_at?.toISOString() ?? null, runAt: row.created_at.toISOString(), relevance: RelevanceSchema.parse(row.relevance) },
        ]),
    );
    return { processes: await loadProcesses([...snapshots.keys()], snapshots), isReport: true };
}

/** Retrieval for the question, as features/chat/services.ts does it: skipped when no document has text. */
async function retrieve(processes: ContextProcess[], question: string): Promise<Passage[]> {
    const searchable = processes.some((process) => process.documents.some((document) => document.readability === "read" || document.readability === "partial"));
    if (!searchable) return [];
    const { embedding } = await embed({
        model: embedModel,
        value: question,
        providerOptions: { voyage: { inputType: "query", outputDimension: EMBEDDING_DIMENSIONS } },
    });
    const { rows } = await pool.query(
        `select process_id, document_id, document_version_id, document_title, source_url, page_start, page_end, content
         from public.retrieve_chat_passages($1, $2, $3::extensions.halfvec, $4, $5)`,
        [processes.map((process) => process.processId), question, JSON.stringify(embedding), embedModel, MAX_PASSAGES],
    );
    return rows.map((row) => ({
        processId: row.process_id,
        documentId: row.document_id,
        documentVersionId: row.document_version_id,
        title: row.document_title,
        url: row.source_url,
        pageStart: row.page_start,
        pageEnd: row.page_end,
        content: row.content,
    }));
}

const overlapsExpected = (expected: Question["expectedPages"], title: string, pageStart: number | null, pageEnd: number | null) =>
    pageStart !== null &&
    expected.some(
        (entry) => entry.document === title && entry.pages.some((page) => page >= pageStart && page <= (pageEnd ?? pageStart)),
    );

// Retrieval and prompts once per question, shared by every model.
const prepared = [];
for (const question of questions) {
    const { processes, isReport } = await loadContext(question);
    const passages = await retrieve(processes, question.question);
    const sources = buildSources(processes, passages);
    const prompt = buildPrompt({ isReport, sources, history: [], question: question.question });
    const retrievedExpected =
        question.expectedPages.length === 0 ? null : passages.some((passage) => overlapsExpected(question.expectedPages, passage.title, passage.pageStart, passage.pageEnd));
    prepared.push({ question, sources, prompt, retrievedExpected });
}
console.log(`Prepared ${prepared.length} questions; ${prepared.length * models.length} answers to generate.`);

const tasks = prepared.flatMap((item) => models.map((model) => ({ item, model })));
const answers: Array<Record<string, unknown>> = [];
let next = 0;
await Promise.all(
    Array.from({ length: concurrency }, async () => {
        while (next < tasks.length) {
            const { item, model } = tasks[next++];
            const startedAt = performance.now();
            try {
                const result = await generateText({
                    model,
                    instructions: item.prompt.instructions,
                    messages: item.prompt.messages,
                    maxOutputTokens: MAX_OUTPUT_TOKENS,
                });
                const latencyMs = Math.round(performance.now() - startedAt);
                const { content, citations, unknownIds, unverified } = validateCitations(result.text, item.sources);
                const price = pricing.get(model);
                const inputTokens = result.usage.inputTokens ?? 0;
                const outputTokens = result.usage.outputTokens ?? 0;
                answers.push({
                    expediente: item.question.expediente,
                    question: item.question.question,
                    kind: item.question.kind,
                    model,
                    responseModel: result.response.modelId,
                    answer: content,
                    citations: citations.map((citation) => ({ id: citation.id, title: citation.title, pageStart: citation.pageStart, pageEnd: citation.pageEnd })),
                    unknownIds,
                    unverified,
                    citedExpected:
                        item.question.expectedPages.length === 0
                            ? null
                            : citations.some((citation) => overlapsExpected(item.question.expectedPages, citation.title, citation.pageStart, citation.pageEnd)),
                    retrievedExpected: item.retrievedExpected,
                    inputTokens,
                    outputTokens,
                    latencyMs,
                    costUsd: price ? inputTokens * price.input + outputTokens * price.output : null,
                });
                console.log(`${model} · ${item.question.expediente} · ${latencyMs} ms`);
            } catch (error) {
                answers.push({ expediente: item.question.expediente, question: item.question.question, model, error: errorMessage(error) });
                console.error(`${model} · ${item.question.expediente} · failed: ${errorMessage(error)}`);
            }
        }
    }),
);
await pool.end();

const summary = models.map((model) => {
    const mine = answers.filter((answer) => answer.model === model && !answer.error);
    const withPages = mine.filter((answer) => answer.citedExpected !== null);
    const total = (key: string) => mine.reduce((sum, answer) => sum + Number(answer[key] ?? 0), 0);
    const latencies = mine.map((answer) => Number(answer.latencyMs)).sort((a, b) => a - b);
    return {
        model,
        answered: mine.length,
        failed: answers.filter((answer) => answer.model === model && answer.error).length,
        answersWithUnknownIds: mine.filter((answer) => (answer.unknownIds as string[]).length > 0).length,
        unverified: mine.filter((answer) => answer.unverified).length,
        citedExpectedPages: `${withPages.filter((answer) => answer.citedExpected).length}/${withPages.length}`,
        medianLatencyMs: latencies[Math.floor(latencies.length / 2)] ?? null,
        inputTokens: total("inputTokens"),
        outputTokens: total("outputTokens"),
        costUsd: Number(total("costUsd").toFixed(5)),
    };
});
console.table(summary);

const order = (answer: Record<string, unknown>) => `${questions.findIndex((question) => question.question === answer.question)}`.padStart(3, "0") + answer.model;
const file = new URL(`./results/chat-${new Date().toISOString().slice(0, 10)}-${set}.json`, import.meta.url);
await mkdir(new URL("./results/", import.meta.url), { recursive: true });
await writeFile(file, `${JSON.stringify({ set, models, embedModel, summary, answers: answers.sort((a, b) => order(a).localeCompare(order(b))) }, null, 2)}\n`);
console.log(`Report: ${file.pathname}`);
