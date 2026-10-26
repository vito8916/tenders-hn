import type { TrackedState } from "@/features/opportunities/schemas";
import type { Relevance, SearchRunMatch } from "./schemas";

/**
 * The organization's views of its opportunities (plan D7, spec 0.4 §12.1), built from the latest finished
 * run of each search. A process shows once per view whatever number of runs found it, and only while it is
 * open; a run's frozen results stay reachable on its own page (/updates/<run>).
 */

/**
 * A run's match with the run and search it came from (the detail and the chat open it in that run) and the
 * organization's tracking of the process, null while it is «Nueva».
 */
export type Opportunity = SearchRunMatch & { runId: string; searchId: string; tracking: TrackedState | null };

export type HomeView =
    | { kind: "recomendadas" }
    | { kind: "todas" }
    | { kind: "nuevas" }
    | { kind: "seguimiento" }
    | { kind: "descartadas" }
    | { kind: "lista"; searchId: string }
    /** A run's frozen results, from the history and from report emails and notifications. */
    | { kind: "update"; runId: string };

/** Where each view lives; the organization's Home opens Recomendadas. */
export function homeViewPath(orgSlug: string, view: HomeView) {
    const orgHref = `/organizations/${orgSlug}`;
    switch (view.kind) {
        case "recomendadas":
            return `${orgHref}/opportunities/recommended`;
        case "todas":
            return `${orgHref}/opportunities/all`;
        case "nuevas":
            return `${orgHref}/opportunities/new`;
        case "seguimiento":
            return `${orgHref}/opportunities/tracking`;
        case "descartadas":
            return `${orgHref}/opportunities/discarded`;
        case "lista":
            return `${orgHref}/lists/${view.searchId}`;
        case "update":
            return `${orgHref}/updates/${view.runId}`;
    }
}

const RELEVANCE_RANK: Record<Relevance, number> = { muy_relevante: 0, posible: 1, pendiente: 2, descartada: 3 };

const isOpen = (match: SearchRunMatch, now: Date) => match.closesAt === null || new Date(match.closesAt) > now;

/** One row per process: the most relevant one, «nueva» if any run says so, else «actualizada» if any does. */
function mergeByProcess(rows: Opportunity[]) {
    const merged = new Map<string, Opportunity>();
    for (const row of rows) {
        const kept = merged.get(row.processId);
        if (!kept) {
            merged.set(row.processId, row);
            continue;
        }
        const best = RELEVANCE_RANK[row.relevance] < RELEVANCE_RANK[kept.relevance] ? row : kept;
        const states = [kept.matchState, row.matchState];
        const matchState = states.includes("nueva") ? "nueva" : states.includes("actualizada") ? "actualizada" : best.matchState;
        merged.set(row.processId, { ...best, matchState });
    }
    return [...merged.values()];
}

export type RunMatches = { searchId: string; runId: string; isDefault: boolean; matches: SearchRunMatch[] };

/** Tracked with any status but descartada. */
export const isFollowed = (row: Opportunity) => row.tracking !== null && row.tracking.status !== "descartada";

/**
 * The views over the latest finished run of each active search.
 * - Recomendadas: the default search's muy relevantes.
 * - Lists: each search's results but the discarded ones.
 * - Todas: every search's results but the discarded ones, one row per process.
 * - Nuevas: what in Todas nobody on the team has acted on.
 * - En seguimiento: what the team tracks (any status but descartada), even once the process closes or
 *   the latest runs no longer find it; `tracked` has those rows, from the latest run that found each.
 * - Descartadas: processes every run discarded and those the team discarded, which leave the other
 *   views; one the team tracks leaves Descartadas.
 */
export function composeOpportunities({
    runs,
    tracking,
    tracked = [],
    now,
}: {
    runs: RunMatches[];
    tracking: Map<string, TrackedState>;
    tracked?: Opportunity[];
    now: Date;
}) {
    const tagged = runs.map((run) => ({
        ...run,
        rows: run.matches.map(
            (match): Opportunity => ({ ...match, runId: run.runId, searchId: run.searchId, tracking: tracking.get(match.processId) ?? null }),
        ),
    }));
    const open = tagged.map((run) => ({ ...run, rows: run.rows.filter((row) => isOpen(row, now)) }));
    const kept = (row: Opportunity) => row.relevance !== "descartada" && row.tracking?.status !== "descartada";

    const byList = new Map(open.map((run) => [run.searchId, run.rows.filter(kept)]));
    const recomendadas = open.find((run) => run.isDefault)?.rows.filter((row) => kept(row) && row.relevance === "muy_relevante") ?? [];
    const todas = mergeByProcess(open.flatMap((run) => run.rows.filter(kept)));
    const nuevas = todas.filter((row) => row.tracking === null);
    const seguimiento = mergeByProcess([...tagged.flatMap((run) => run.rows), ...tracked].filter(isFollowed));
    const keptIds = new Set(todas.map((row) => row.processId));
    const descartadas = mergeByProcess(open.flatMap((run) => run.rows.filter((row) => !keptIds.has(row.processId) && !isFollowed(row))));

    return { recomendadas, todas, nuevas, seguimiento, descartadas, byList };
}
