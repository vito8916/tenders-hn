// Second opinion on the v2 labels. The human labels outside software were not
// made by someone who knows each trade, so a model labels every pooled
// process against the corporate purpose, with the labeling page's rules and
// the same information the page showed, without seeing the human label.
// Disagreements go back to review; the model's labels never replace the
// human ones, because the harness evaluates models against these labels.
// Agreement on software, the labeler's own field, shows how far to trust the
// model elsewhere.
//
//   pnpm --filter worker eval:second-opinion [--model=anthropic/claude-opus-5.5] [--concurrency=8] [--limit=N]
//
// Asks the model through the AI Gateway, which costs money: confirm the model
// and the estimate first (about 2 cents per process on claude-opus-5.5).
// Without the gateway, a model in a Claude Code session can answer instead:
//
//   ... eval:second-opinion --export=<dir> [--batch=100]   pending prompts as <dir>/batch-NN.jsonl
//   ... eval:second-opinion --import=<dir> --model=<name>   answers from <dir>/answers-*.jsonl
//
// Reads the page data eval:build-pools wrote (worker/.eval-page/v2/) and
// labeled-set/v2/labels.json. Writes labeled-set/v2/second-opinion-<model>-<version>.json
// after every answer; a rerun only asks for what is missing. Then writes that
// model's disagreements to worker/.eval-page/v2/opinions/, for the page's review mode.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { generateText, Output } from "ai";
import { z } from "zod";
import { errorMessage } from "../log";
import { labeledSetUrl, loadProfiles } from "./labeled-set";

const argument = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const model = argument("model") ?? "anthropic/claude-opus-5.5";
const concurrency = Number(argument("concurrency") ?? 8);
const limit = Number(argument("limit") ?? Infinity);
const exportDir = argument("export");
const importDir = argument("import");
const batchSize = Number(argument("batch") ?? 100);
if (importDir && !argument("model")) {
    console.error("--import needs --model=<the model that answered>.");
    process.exit(1);
}

// Bump when the instructions, the schema, or the process text change.
const PROMPT_VERSION = "v1";
const LABELS = ["core", "adjacent", "not_relevant", "unsure"] as const;
type Label = (typeof LABELS)[number];

const opinionSchema = z.object({
    purchase: z.string().describe("Qué pide el proceso, en una frase"),
    clause: z
        .string()
        .describe("Frase del objeto social que cubre lo que se compra, copiada literalmente; vacía si solo la cláusula de cierre lo cubriría"),
    reason: z
        .string()
        .describe("Por qué esta etiqueta, en una o dos oraciones, con el conocimiento del rubro que hace falta para decidir"),
    label: z.enum(LABELS),
});

const INSTRUCTIONS = `Eres un experto en compras públicas de Honduras y en los rubros de las empresas que participan en ellas. Recibes el objeto social de una empresa y un proceso de compra publicado en HonduCompras. Decide si la empresa querría revisar ese proceso.

Etiquetas:
- core: el proceso pide principalmente lo que describe la finalidad principal (el primer párrafo del objeto social).
- adjacent: encaja en otra actividad que el objeto social enumera, o un lote o una línea de un proceso mixto encaja.
- not_relevant: solo la cláusula de cierre («cualquier otra actividad de lícito comercio» o similar) lo cubriría.
- unsure: la información del proceso no basta para decidir.

Juzga por lo que pide el proceso, no por quién compra. Usa lo que sabes del rubro: qué bienes, servicios, insumos y obras abarca de verdad cada actividad que el objeto social nombra, y qué no abarca aunque se parezca.`;

interface PageItem {
    processId: string;
    expediente: string;
    title: string;
    entity: string;
    purchaseUnit: string | null;
    modality: string | null;
    stage: string | null;
    products: string | null;
    documents: string[];
}
interface PageDetail {
    lines: { description: string; quantity: number | null; specifications: string | null; unspsc: string | null }[];
    documentLinks: { title: string }[];
    excerpts: { document: string; page: number; text: string }[];
}
interface Opinion {
    processId: string;
    expediente: string;
    label: Label;
    purchase: string;
    clause: string;
    reason: string;
    inputTokens: number | undefined;
    outputTokens: number | undefined;
}

// The process as the labeling page showed it.
const processText = (item: PageItem, detail: PageDetail | undefined) => {
    const lines = detail?.lines ?? [];
    const documents = detail?.documentLinks.map((document) => document.title) ?? item.documents;
    return [
        `Expediente: ${item.expediente}`,
        `Título: ${item.title}`,
        `Institución: ${item.entity}`,
        item.purchaseUnit && `Unidad de compra: ${item.purchaseUnit}`,
        (item.modality || item.stage) && `Modalidad: ${[item.modality, item.stage].filter(Boolean).join(" · ")}`,
        lines.length
            ? `Líneas de producto:\n${lines
                  .map(
                      (line) =>
                          `- ${line.description}${line.quantity != null ? ` × ${line.quantity}` : ""}${line.unspsc ? ` [UNSPSC ${line.unspsc}]` : ""}` +
                          (line.specifications ? `\n  Especificaciones: ${line.specifications}` : ""),
                  )
                  .join("\n")}`
            : detail
              ? "Líneas de producto: ninguna publicada en HonduCompras."
              : item.products && `Productos: ${item.products}`,
        `Documentos publicados: ${documents.length ? documents.join(" · ") : "ninguno"}`,
        detail?.excerpts.length &&
            `Extractos de los documentos (elegidos automáticamente; pueden ser texto genérico):\n${detail.excerpts
                .map((excerpt) => `[${excerpt.document}, p. ${excerpt.page}] ${excerpt.text}`)
                .join("\n\n")}`,
    ]
        .filter(Boolean)
        .join("\n");
};

const setUrl = labeledSetUrl("v2");
const pageUrl = new URL("../../.eval-page/v2/", import.meta.url);
const outputUrl = new URL(`second-opinion-${model.replace(/[^a-z0-9.]+/gi, "-")}-${PROMPT_VERSION}.json`, setUrl);

const profiles = await loadProfiles("v2");
const details: Record<string, PageDetail> = JSON.parse(await readFile(new URL("details.json", pageUrl), "utf8"));
const humanLabels: Record<string, { processId: string; label: Label }[]> = JSON.parse(
    await readFile(new URL("labels.json", setUrl), "utf8"),
).profiles;
const saved: { profiles: Record<string, Opinion[]> } = await readFile(outputUrl, "utf8").then(
    (text) => JSON.parse(text),
    () => ({ profiles: {} }),
);
const opinions: Record<string, Opinion[]> = Object.fromEntries(profiles.map((profile) => [profile.key, saved.profiles[profile.key] ?? []]));
// Answers arrive concurrently; writes go one at a time so the file is never half written.
let saving = Promise.resolve();
const save = () =>
    (saving = saving.then(() =>
        writeFile(outputUrl, JSON.stringify({ model, promptVersion: PROMPT_VERSION, instructions: INSTRUCTIONS, profiles: opinions }, null, 1) + "\n"),
    ));

const jobs: { profile: (typeof profiles)[number]; item: PageItem }[] = [];
for (const profile of profiles) {
    const { items }: { items: PageItem[] } = JSON.parse(await readFile(new URL(`pools/${profile.key}.json`, pageUrl), "utf8"));
    const done = new Set(opinions[profile.key].map((opinion) => opinion.processId));
    jobs.push(...items.filter((item) => !done.has(item.processId)).map((item) => ({ profile, item })));
}
jobs.splice(limit);
const promptFor = ({ profile, item }: (typeof jobs)[number]) =>
    `Objeto social de la empresa «${profile.name}»:\n\n${profile.description}\n\n---\n\nProceso:\n${processText(item, details[item.processId])}`;

if (exportDir) {
    const dirUrl = new URL(`${exportDir.replace(/\/$/, "")}/`, `file://${process.cwd()}/`);
    await mkdir(dirUrl, { recursive: true });
    const format = `Responde con una línea JSON por proceso, en answers-NN.jsonl (NN el número del lote):
{"profile": "...", "processId": "...", "purchase": "...", "clause": "...", "reason": "...", "label": "core|adjacent|not_relevant|unsure"}
${Object.entries(opinionSchema.shape)
    .map(([field, schema]) => `- ${field}: ${schema.description ?? "una de las etiquetas"}`)
    .join("\n")}`;
    await writeFile(new URL("instructions.md", dirUrl), `${INSTRUCTIONS}\n\n${format}\n`);
    for (let start = 0; start < jobs.length; start += batchSize) {
        const lines = jobs
            .slice(start, start + batchSize)
            .map((job) => JSON.stringify({ profile: job.profile.key, processId: job.item.processId, prompt: promptFor(job) }));
        await writeFile(new URL(`batch-${String(start / batchSize + 1).padStart(2, "0")}.jsonl`, dirUrl), lines.join("\n") + "\n");
    }
    console.log(`${jobs.length} prompts in ${Math.ceil(jobs.length / batchSize)} batches, with instructions.md, in ${dirUrl.pathname}`);
    process.exit(0);
}

if (importDir) {
    const dirUrl = new URL(`${importDir.replace(/\/$/, "")}/`, `file://${process.cwd()}/`);
    const pending = new Map(jobs.map((job) => [`${job.profile.key}--${job.item.processId}`, job]));
    let imported = 0;
    for (const file of (await readdir(dirUrl)).filter((name) => /^answers-.*\.jsonl$/.test(name)).sort()) {
        for (const line of (await readFile(new URL(file, dirUrl), "utf8")).split("\n").filter((text) => text.trim())) {
            const { profile, processId, ...answer } = JSON.parse(line);
            const job = pending.get(`${profile}--${processId}`);
            const parsed = opinionSchema.safeParse(answer);
            if (!job || !parsed.success) {
                console.error(`${file}: skipped ${profile} ${processId}: ${job ? parsed.error?.message : "not pending"}`);
                continue;
            }
            pending.delete(`${profile}--${processId}`);
            opinions[profile].push({ processId, expediente: job.item.expediente, ...parsed.data, inputTokens: undefined, outputTokens: undefined });
            imported++;
        }
    }
    await save();
    console.log(`Imported ${imported} answers from ${model}; ${pending.size} processes still have none.`);
}

if (!importDir) console.log(`${model}: ${jobs.length} processes to judge, ${concurrency} at a time.`);
let next = importDir ? jobs.length : 0;
let finished = 0;
let failed = 0;
const judgeNext = async (): Promise<void> => {
    const job = jobs[next++];
    if (!job) return;
    const { profile, item } = job;
    try {
        const result = await generateText({
            model,
            instructions: INSTRUCTIONS,
            prompt: promptFor(job),
            output: Output.object({ schema: opinionSchema, name: "etiqueta" }),
        });
        opinions[profile.key].push({
            processId: item.processId,
            expediente: item.expediente,
            ...result.output,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
        });
        await save();
    } catch (error) {
        failed++;
        console.error(`${profile.key} ${item.expediente}: ${errorMessage(error)}`);
    }
    if (++finished % 50 === 0) console.log(`${finished} / ${jobs.length}`);
    return judgeNext();
};
await Promise.all(Array.from({ length: concurrency }, judgeNext));
if (failed) console.error(`${failed} failed; run again to retry them.`);

// Agreement with the human labels, per profile: rows are the human label, columns the model's.
const relevant = (label: Label) => label === "core" || label === "adjacent";
for (const profile of profiles) {
    const modelLabel = new Map(opinions[profile.key].map((opinion) => [opinion.processId, opinion.label]));
    const pairs = humanLabels[profile.key].flatMap((item) => {
        const label = modelLabel.get(item.processId);
        return label ? [{ human: item.label, model: label }] : [];
    });
    const same = pairs.filter((pair) => pair.human === pair.model).length;
    const sameSide = pairs.filter(
        (pair) => pair.human !== "unsure" && pair.model !== "unsure" && relevant(pair.human) === relevant(pair.model),
    ).length;
    const bothSure = pairs.filter((pair) => pair.human !== "unsure" && pair.model !== "unsure").length;
    console.log(
        `\n${profile.key}: same label ${same}/${pairs.length}; same side of relevant ${sameSide}/${bothSure} where neither is unsure`,
    );
    console.table(
        Object.fromEntries(
            LABELS.map((human) => [
                `human ${human}`,
                Object.fromEntries(LABELS.map((label) => [label, pairs.filter((pair) => pair.human === human && pair.model === label).length])),
            ]),
        ),
    );
}

// The disagreements, for the labeling page's review mode (collection opinions_v2, one document per company).
await mkdir(new URL("opinions/", pageUrl), { recursive: true });
for (const profile of profiles) {
    const humanLabel = new Map(humanLabels[profile.key].map((item) => [item.processId, item.label]));
    const items = opinions[profile.key]
        .filter((opinion) => opinion.label !== humanLabel.get(opinion.processId))
        .map(({ processId, label, purchase, clause, reason }) => ({ processId, modelLabel: label, purchase, clause, reason }));
    await writeFile(new URL(`opinions/${profile.key}.json`, pageUrl), JSON.stringify({ model, promptVersion: PROMPT_VERSION, items }) + "\n");
}

const tokens = (key: "inputTokens" | "outputTokens") =>
    Object.values(opinions)
        .flat()
        .reduce((sum, opinion) => sum + (opinion[key] ?? 0), 0);
console.log(`\nTokens: ${tokens("inputTokens")} in, ${tokens("outputTokens")} out. Written to ${outputUrl.pathname}`);
