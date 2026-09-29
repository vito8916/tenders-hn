// Builds the pools to label for a labeled-set version from its profiles.
// The population is v1's snapshot (the processes open on 29 Sep 2026), so v2
// labels cover the same processes and the harness ranks within the same set.
// A corporate purpose runs several paragraphs on different lines of business,
// and one embedding of the whole text averages them, so a process that fits a
// single clause can rank low. Each profile's pool therefore joins three
// retrievals, so that none of the methods the harness compares is favored by
// what got labeled:
//   whole      the whole text as one query
//   paragraph  each paragraph as its own query, fused by reciprocal rank
//   profile    each line of business of the extracted profile
//              (extracted-profiles-<version>.json) as its own query, with its
//              keywords as terms and its proposed classes as codes, fused
// plus a random sample of the rest to estimate what all three miss. Items are
// shuffled so the labeler cannot tell how one was found.
//
//   DATABASE_URL=<production> pnpm --filter worker eval:build-pools [--set=v2] [--retrieved=150] (per method) [--sampled=60]
//
// Writes labeled-set/<set>/pools.json (for the harness) and, under
// worker/.eval-page/<set>/, the documents the labeling page reads: one per
// profile, and the product lines, document links, and excerpts per process.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { embedMany } from "ai";
import { Pool } from "pg";
import { EMBEDDING_DIMENSIONS, modelForRole } from "@/lib/ai/models";
import { env } from "../env";
import type { ProcessDetail } from "../honducompras/parse";
import { EXTRACTION_VERSION, type LineOfBusiness } from "../matching/profile";
import { lineQueryText } from "../matching/unspsc";
import { embedProfile, labeledSetUrl, loadLabeledSet, loadPopulation, loadProfiles, retrieveCandidates, type LabeledSetVersion, type Pools } from "./labeled-set";
import type { PoolItem } from "./retrieval";

const argument = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const set = (argument("set") ?? "v2") as LabeledSetVersion;
const retrievedLimit = Number(argument("retrieved") ?? 150);
const sampledCount = Number(argument("sampled") ?? 60);
// Excerpts stand in for product lines on processes that list none.
const EXCERPTS_PER_PROCESS = 3;
const EXCERPT_CHARS = 700;

const shuffle = <T>(items: T[]) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

const profiles = await loadProfiles(set);
const extractedFile = `extracted-profiles-${EXTRACTION_VERSION}.json`;
const extracted: Record<string, { profile: { linesOfBusiness: (LineOfBusiness & { unspscClasses: { code: string }[] })[] } }> = JSON.parse(
    await readFile(new URL(extractedFile, labeledSetUrl(set)), "utf8"),
).profiles;
const missing = profiles.filter((profile) => !extracted[profile.key]);
if (missing.length) {
    console.error(`${extractedFile} has no extraction for ${missing.map((profile) => profile.key).join(", ")}. Run eval:extract-profiles first.`);
    process.exit(1);
}
const v1 = await loadLabeledSet("v1");
const model = modelForRole("embed");
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
const { populationIds } = await loadPopulation(pool, v1.pools, v1.labels, model);

const pools: Pools & { builtAt: string; retrieval: Record<string, unknown> } = {
    generatedAt: v1.pools.generatedAt,
    builtAt: new Date().toISOString(),
    retrieval: {
        function: "public.retrieve_candidates",
        model,
        query: "union of the whole description, its paragraphs fused by reciprocal rank, and the extracted profile's lines of business fused (keywords as terms, proposed classes as prefixes); inputType query",
        extraction: extractedFile,
        retrievedLimit,
        sampled: sampledCount,
        population: "labeled-set v1 snapshot",
    },
    profiles: {},
};

for (const profile of profiles) {
    const retrieve = async (embedding: number[], terms = profile.offerings, unspsc = profile.unspsc) =>
        (await retrieveCandidates(pool, { terms, model, embedding, unspsc, populationIds })).map((candidate) => candidate.process_id);
    const embedQueries = async (values: string[]) =>
        (await embedMany({ model, values, providerOptions: { voyage: { inputType: "query", outputDimension: EMBEDDING_DIMENSIONS } } })).embeddings;
    // Reciprocal-rank fusion of several ranked lists, best first.
    const fuse = (lists: string[][]) => {
        const scores = new Map<string, number>();
        for (const list of lists) {
            for (const [index, processId] of list.entries()) {
                scores.set(processId, (scores.get(processId) ?? 0) + 1 / (60 + index + 1));
            }
        }
        return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([processId]) => processId);
    };

    const wholeRanked = (await retrieve(await embedProfile(profile, model))).slice(0, retrievedLimit);

    const paragraphs = profile.description.split(/\n\s*\n/).filter((paragraph) => paragraph.trim());
    const paragraphLists = [];
    for (const embedding of await embedQueries(paragraphs)) {
        paragraphLists.push(await retrieve(embedding));
    }
    const paragraphRanked = fuse(paragraphLists).slice(0, retrievedLimit);

    const lines = extracted[profile.key].profile.linesOfBusiness;
    const lineEmbeddings = await embedQueries(lines.map(lineQueryText));
    const lineLists = [];
    for (const [index, line] of lines.entries()) {
        lineLists.push(await retrieve(lineEmbeddings[index], line.keywords, line.unspscClasses.map((item) => item.code)));
    }
    const profileRanked = fuse(lineLists).slice(0, retrievedLimit);

    const wholeRank = new Map(wholeRanked.map((processId, index) => [processId, index + 1]));
    const paragraphRank = new Map(paragraphRanked.map((processId, index) => [processId, index + 1]));
    const profileRank = new Map(profileRanked.map((processId, index) => [processId, index + 1]));
    const retrieved = [...new Set([...wholeRanked, ...paragraphRanked, ...profileRanked])];
    const retrievedIds = new Set(retrieved);
    const notRetrieved = populationIds.filter((id) => !retrievedIds.has(id));
    const sampled = shuffle(notRetrieved).slice(0, sampledCount);

    const items: PoolItem[] = [
        ...retrieved.map((processId) => ({
            processId,
            expediente: "",
            stratum: "retrieved" as const,
            rank: wholeRank.get(processId) ?? null,
            paragraphRank: paragraphRank.get(processId) ?? null,
            profileRank: profileRank.get(processId) ?? null,
            score: null,
        })),
        ...sampled.map((processId) => ({ processId, expediente: "", stratum: "sampled" as const, rank: null, score: null })),
    ];
    pools.profiles[profile.key] = {
        population: populationIds.length,
        notRetrieved: notRetrieved.length,
        sampleWeight: Math.round((notRetrieved.length / Math.max(sampled.length, 1)) * 10_000) / 10_000,
        items: shuffle(items),
    };
    const onlyBy = (ranked: string[], others: Map<string, number>[]) => ranked.filter((id) => others.every((other) => !other.has(id))).length;
    console.log(
        `${profile.key}: ${retrieved.length} retrieved (top ${retrievedLimit} each; found only by whole text ${onlyBy(wholeRanked, [paragraphRank, profileRank])}, ` +
            `only by ${paragraphs.length} paragraphs ${onlyBy(paragraphRanked, [wholeRank, profileRank])}, ` +
            `only by ${lines.length} lines of business ${onlyBy(profileRanked, [wholeRank, paragraphRank])}), ${sampled.length} sampled of ${notRetrieved.length}`,
    );
}

const pooledIds = [...new Set(Object.values(pools.profiles).flatMap((profilePool) => profilePool.items.map((item) => item.processId)))];

const { rows: processRows } = await pool.query<{
    id: string;
    expediente: string;
    title: string;
    buyer_entity: string;
    purchase_unit: string | null;
    modality: string | null;
    stage: string | null;
    closes_at: Date | null;
    detail_url: string;
    products_text: string | null;
    unspsc_codes: string[];
    products: ProcessDetail["products"] | null;
}>(
    `select p.id, p.expediente, p.title, p.buyer_entity, p.purchase_unit, p.modality, p.stage, p.closes_at, p.detail_url,
            p.products_text, p.unspsc_codes, v.detail -> 'products' as products
     from public.procurement_processes p
     left join public.process_versions v on v.id = p.current_version_id
     where p.id = any($1::uuid[])`,
    [pooledIds],
);
const { rows: documentRows } = await pool.query<{ process_id: string; title: string; source_url: string }>(
    `select process_id, title, source_url from public.source_documents
     where process_id = any($1::uuid[]) and removed_at is null
     order by process_id, first_seen_at`,
    [pooledIds],
);
const withoutLines = processRows.filter((row) => !row.products?.length).map((row) => row.id);
// Passages that state the object of the purchase come first, then the pliego before other files.
const { rows: excerptRows } = await pool.query<{ process_id: string; title: string; source_url: string; page_start: number; content: string }>(
    `select process_id, title, source_url, page_start, content
     from (
       select d.process_id, d.title, d.source_url, c.page_start, c.content,
              row_number() over (
                partition by d.process_id
                order by (c.content ilike '%objeto%') desc,
                         array_position(array['pliego', 'aviso', 'anexo', 'other'], d.kind),
                         d.first_seen_at, c.ordinal
              ) as position
       from public.source_documents d
       join public.document_chunks c on c.document_version_id = d.current_version_id and c.embedding_model = $2
       where d.process_id = any($1::uuid[]) and d.removed_at is null
     ) ranked
     where position <= $3
     order by process_id, position`,
    [withoutLines, model, EXCERPTS_PER_PROCESS],
);
await pool.end();

const processById = new Map(processRows.map((row) => [row.id, row]));
const groupBy = <T extends { process_id: string }>(rows: T[]) =>
    rows.reduce((groups, row) => groups.set(row.process_id, [...(groups.get(row.process_id) ?? []), row]), new Map<string, T[]>());
const documentsByProcess = groupBy(documentRows);
const excerptsByProcess = groupBy(excerptRows);

for (const profilePool of Object.values(pools.profiles)) {
    for (const item of profilePool.items) {
        item.expediente = processById.get(item.processId)?.expediente ?? "";
    }
}

const setUrl = labeledSetUrl(set);
await writeFile(new URL("pools.json", setUrl), JSON.stringify(pools, null, 1) + "\n");

const pageUrl = new URL(`../../.eval-page/${set}/`, import.meta.url);
await mkdir(new URL("pools/", pageUrl), { recursive: true });
for (const [order, profile] of profiles.entries()) {
    const items = pools.profiles[profile.key].items.map(({ processId }) => {
        const process = processById.get(processId);
        return {
            processId,
            expediente: process?.expediente ?? "",
            title: process?.title ?? "",
            entity: process?.buyer_entity ?? "",
            purchaseUnit: process?.purchase_unit ?? null,
            modality: process?.modality ?? null,
            stage: process?.stage ?? null,
            closesAt: process?.closes_at?.toISOString() ?? null,
            detailUrl: process?.detail_url ?? "",
            products: process?.products_text ?? null,
            unspsc: process?.unspsc_codes ?? [],
            documents: (documentsByProcess.get(processId) ?? []).map((document) => document.title),
        };
    });
    await writeFile(
        new URL(`pools/${profile.key}.json`, pageUrl),
        JSON.stringify({ name: profile.name, description: profile.description, offerings: profile.offerings, order, items }) + "\n",
    );
}

const details = Object.fromEntries(
    pooledIds.map((processId) => [
        processId,
        {
            lines: (processById.get(processId)?.products ?? []).map((product) => ({
                description: product.description,
                quantity: product.quantity,
                specifications: product.specifications,
                unspsc: product.unspsc,
            })),
            documentLinks: (documentsByProcess.get(processId) ?? []).map((document) => ({ title: document.title, url: document.source_url })),
            excerpts: (excerptsByProcess.get(processId) ?? []).map((excerpt) => ({
                document: excerpt.title,
                page: excerpt.page_start,
                text: excerpt.content.length > EXCERPT_CHARS ? `${excerpt.content.slice(0, EXCERPT_CHARS).replace(/\s+\S*$/, "")}…` : excerpt.content,
                url: excerpt.source_url,
            })),
        },
    ]),
);
await writeFile(new URL("details.json", pageUrl), JSON.stringify(details) + "\n");

console.log(`${pooledIds.length} processes pooled. Harness pools: ${new URL("pools.json", setUrl).pathname}. Page data: ${pageUrl.pathname}`);
