// Extracts a matching profile from each test company's corporate purpose
// (labeled-set/<set>/profiles.json) for review, the way a customer would
// review theirs at onboarding. Each line of business gets the UNSPSC classes
// nearest to it in meaning (CUBS class names and HonduCompras product
// descriptions, see matching/unspsc.ts); the model's own codes are shown only
// as hints, flagged when the catalog does not list them.
//
//   DATABASE_URL=<production> pnpm --filter worker eval:extract-profiles [--set=v2] [--reuse]
//
// --reuse keeps the saved extraction for this version and only proposes the
// classes again, without calling the extraction model.
//
// Writes labeled-set/<set>/extracted-profiles-<extraction version>.json.
import { readFile, writeFile } from "node:fs/promises";
import { modelForRole } from "@/lib/ai/models";
import { Pool } from "pg";
import { env } from "../env";
import { errorMessage } from "../log";
import { EXTRACTION_VERSION, extractProfile, linesWithoutSource, type ExtractedProfile } from "../matching/profile";
import { catalogNames, deriveClasses } from "../matching/unspsc";
import { labeledSetUrl, loadProfiles, type LabeledSetVersion } from "./labeled-set";

const set = (process.argv.find((arg) => arg.startsWith("--set="))?.slice("--set=".length) ?? "v2") as LabeledSetVersion;
const reuse = process.argv.includes("--reuse");
const outputUrl = new URL(`extracted-profiles-${EXTRACTION_VERSION}.json`, labeledSetUrl(set));
const TIER_LABELS = { primary: "Primary", secondary: "Secondary", optional: "Optional" } as const;

const profiles = await loadProfiles(set);
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });

const { rows: readiness } = await pool.query<{ pending: number; terms: number }>(
    `select
       (select count(*)::int from pgmq.q_ingest where message ->> 'type' like 'sync_catalog%')
       + (select count(*)::int from pgmq.q_docs where message ->> 'type' = 'embed_catalog') as pending,
       (select count(*)::int from public.unspsc_terms where embedding_model = $1) as terms`,
    [modelForRole("embed")],
);
if (readiness[0].pending || !readiness[0].terms) {
    console.error(
        `The catalog is not ready: ${readiness[0].pending} catalog jobs queued, ${readiness[0].terms} terms embedded. ` +
            "Wait for sync_catalog and embed_catalog to finish.",
    );
    process.exit(1);
}

type Extraction = Awaited<ReturnType<typeof extractProfile>>;
const saved: Record<string, Extraction> = reuse ? JSON.parse(await readFile(outputUrl, "utf8")).profiles : {};

const extracted: Record<string, unknown> = {};

for (const company of profiles) {
    let result: Extraction;
    if (reuse) {
        if (!saved[company.key]) {
            console.error(`${company.key}: no saved extraction to reuse`);
            continue;
        }
        result = saved[company.key];
    } else {
        try {
            result = await extractProfile(company.description);
        } catch (error) {
            console.error(`${company.key}: extraction failed: ${errorMessage(error)}`);
            continue;
        }
        await pool.query(
            `insert into public.ai_usage_events (role, model, input_tokens, output_tokens, latency_ms, status, reference)
             values ('extract', $1, $2, $3, $4, 'succeeded', $5)`,
            [result.model, result.inputTokens ?? null, result.outputTokens ?? null, result.latencyMs, { type: "profile_extraction", set, profile: company.key }],
        );
    }
    const profile: ExtractedProfile = result.profile;

    const hintNames = await catalogNames(pool, [...new Set(profile.linesOfBusiness.flatMap((line) => line.unspscHints))]);
    const lines = [];
    for (const line of profile.linesOfBusiness) {
        const { proposed, unused } = await deriveClasses(pool, line);
        lines.push({ ...line, unspscClasses: proposed, unusedClasses: unused });
    }
    const unsourced = linesWithoutSource(profile, company.description).map((line) => line.name);

    extracted[company.key] = { ...result, name: company.name, profile: { ...profile, linesOfBusiness: lines }, hintNames, linesWithoutSource: unsourced };

    console.log(`\n=== ${company.name} (${result.model}, ${result.inputTokens} in / ${result.outputTokens} out, ${result.latencyMs} ms)`);
    console.log(profile.summary);
    for (const tier of ["primary", "secondary", "optional"] as const) {
        const tierLines = lines.filter((line) => line.tier === tier);
        if (!tierLines.length) continue;
        console.log(`\n  ${TIER_LABELS[tier]}`);
        for (const line of tierLines) {
            console.log(`  - ${line.name}${unsourced.includes(line.name) ? "  [excerpt not found in the text]" : ""}`);
            console.log(`      ${line.description}`);
            console.log(`      keywords: ${line.keywords.join(", ")}`);
            for (const derived of line.unspscClasses) {
                console.log(
                    `      ${derived.code} ${derived.name ?? "[not in the catalog]"} (similarity ${derived.similarity.toFixed(2)}, ${derived.processes} processes)` +
                        (derived.examples.length ? `, e.g. ${derived.examples.join("; ")}` : ""),
                );
            }
            if (!line.unspscClasses.length) console.log("      no class proposed");
            if (line.unusedClasses.length) {
                console.log(`      in the catalog, unused on HonduCompras: ${line.unusedClasses.map((item) => `${item.code} ${item.name}`).join(", ")}`);
            }
            const hints = line.unspscHints.map((code) => `${code} ${hintNames[code] ?? "[not in the catalog]"}`);
            if (hints.length) console.log(`      model hints: ${hints.join(", ")}`);
        }
    }
    console.log(`\n  Ignored clauses: ${profile.ignoredClauses.join(" · ")}`);
}

await pool.end();

await writeFile(
    outputUrl,
    JSON.stringify({ extractedAt: new Date().toISOString(), extractionVersion: EXTRACTION_VERSION, profiles: extracted }, null, 1) + "\n",
);
console.log(`\nSaved: ${outputUrl.pathname}`);
