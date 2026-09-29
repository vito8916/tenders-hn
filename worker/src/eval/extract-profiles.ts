// Extracts a matching profile from each test company's corporate purpose
// (labeled-set/<set>/profiles.json) for review, the way a customer would
// review theirs at onboarding. Each line of business gets the UNSPSC classes
// HonduCompras product lines matching its keywords carry, named from the CUBS
// catalog; the model's own codes are shown only as hints, flagged when the
// catalog does not list them.
//
//   DATABASE_URL=<production> pnpm --filter worker eval:extract-profiles [--set=v2]
//
// Writes labeled-set/<set>/extracted-profiles-<extraction version>.json.
import { writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { env } from "../env";
import { errorMessage } from "../log";
import { EXTRACTION_VERSION, extractProfile, linesWithoutSource } from "../matching/profile";
import { catalogNames, deriveClasses } from "../matching/unspsc";
import { labeledSetUrl, loadProfiles, type LabeledSetVersion } from "./labeled-set";

const set = (process.argv.find((arg) => arg.startsWith("--set="))?.slice("--set=".length) ?? "v2") as LabeledSetVersion;
const TIER_LABELS = { primary: "Primary", secondary: "Secondary", optional: "Optional" } as const;

const profiles = await loadProfiles(set);
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });

const { rows: catalogRows } = await pool.query<{ classes: number }>("select count(*)::int as classes from public.unspsc_catalog where level = 3");
if (!catalogRows[0].classes) {
    console.error("The CUBS catalog is empty here. Let the sync_catalog job finish first.");
    process.exit(1);
}

const extracted: Record<string, unknown> = {};

for (const company of profiles) {
    let result: Awaited<ReturnType<typeof extractProfile>>;
    try {
        result = await extractProfile(company.description);
    } catch (error) {
        console.error(`${company.key}: extraction failed: ${errorMessage(error)}`);
        continue;
    }
    const { profile } = result;
    await pool.query(
        `insert into public.ai_usage_events (role, model, input_tokens, output_tokens, latency_ms, status, reference)
         values ('extract', $1, $2, $3, $4, 'succeeded', $5)`,
        [result.model, result.inputTokens ?? null, result.outputTokens ?? null, result.latencyMs, { type: "profile_extraction", set, profile: company.key }],
    );

    const hintNames = await catalogNames(pool, [...new Set(profile.linesOfBusiness.flatMap((line) => line.unspscHints))]);
    const lines = [];
    for (const line of profile.linesOfBusiness) {
        lines.push({ ...line, unspscClasses: await deriveClasses(pool, line.keywords) });
    }
    const unsourced = linesWithoutSource(profile, company.description).map((line) => line.name);

    extracted[company.key] = { name: company.name, ...result, profile: { ...profile, linesOfBusiness: lines }, hintNames, linesWithoutSource: unsourced };

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
                    `      ${derived.code} ${derived.name ?? "[not in the catalog]"}: ${derived.processes} processes (${Math.round(derived.share * 100)}%), e.g. ${derived.examples.join("; ")}`,
                );
            }
            if (!line.unspscClasses.length) console.log("      no class reaches the threshold");
            const hints = line.unspscHints.map((code) => `${code} ${hintNames[code] ?? "[not in the catalog]"}`);
            if (hints.length) console.log(`      model hints: ${hints.join(", ")}`);
        }
    }
    console.log(`\n  Ignored clauses: ${profile.ignoredClauses.join(" · ")}`);
}

await pool.end();

const outputUrl = new URL(`extracted-profiles-${EXTRACTION_VERSION}.json`, labeledSetUrl(set));
await writeFile(
    outputUrl,
    JSON.stringify({ extractedAt: new Date().toISOString(), extractionVersion: EXTRACTION_VERSION, profiles: extracted }, null, 1) + "\n",
);
console.log(`\nSaved: ${outputUrl.pathname}`);
