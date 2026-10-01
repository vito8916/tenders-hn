import "server-only";
import { z } from "zod";
import { listSavedSearchesService } from "@/features/saved-searches/services";
import {
    getLatestIngestionAt,
    getLatestRuns,
    getSearchRun,
    listLatestFinishedRuns,
    listLatestRuns,
    listRecentRuns,
    listSearchRunMatches,
    requestSearchRun,
} from "./repository";
import { isRunFinished } from "./schemas";

const RECENT_RUNS = 10;

export async function listLatestRunsService(orgId: string) {
    return listLatestRuns(orgId);
}

/**
 * What the Home shows (spec §12.1): the searches, most recently run first,
 * with the new matches of their latest finished run; and for the selected
 * search (the requested one, else the most recently run) its recent runs and
 * the shown run (the requested one, else the latest finished: a run in
 * progress never replaces finished results) with its matches.
 */
export async function getHomeService(params: { orgId: string; searchId: string | null; runId: string | null }) {
    const [searches, latestRuns, finishedRuns, latestIngestionAt] = await Promise.all([
        listSavedSearchesService(params.orgId),
        listLatestRuns(params.orgId),
        listLatestFinishedRuns(params.orgId),
        getLatestIngestionAt(),
    ]);

    const latestBySearch = new Map(latestRuns.map((run) => [run.savedSearchId, run]));
    const finishedBySearch = new Map(finishedRuns.map((run) => [run.savedSearchId, run]));
    // Searches come sorted by name, and the sort is stable, so the ones never run stay last in that order.
    const items = searches
        .map((search) => ({
            search,
            latestRun: latestBySearch.get(search.id) ?? null,
            newMatches: finishedBySearch.get(search.id)?.newMatchesCount ?? 0,
        }))
        .sort((a, b) => (b.latestRun?.createdAt ?? "").localeCompare(a.latestRun?.createdAt ?? ""));

    const selectedItem = items.find((item) => item.search.id === params.searchId) ?? items[0];
    if (!selectedItem) {
        return { items, latestIngestionAt, selected: null };
    }

    const searchId = selectedItem.search.id;
    const recentRuns = await listRecentRuns(searchId, RECENT_RUNS);
    const latestFinished = recentRuns.find((run) => isRunFinished(run.status)) ?? (await getLatestRuns(searchId)).finished;
    const requestedRun =
        params.runId && z.uuid().safeParse(params.runId).success
            ? (recentRuns.find((run) => run.id === params.runId) ?? (await getSearchRun(searchId, params.runId)))
            : null;
    const shownRun = requestedRun ?? latestFinished;
    const matches = shownRun && isRunFinished(shownRun.status) ? await listSearchRunMatches(shownRun.id) : [];

    return {
        items,
        latestIngestionAt,
        selected: { ...selectedItem, recentRuns, shownRun, latestFinished, matches },
    };
}

/** Any member runs an active search; request_search_run enforces it. */
export async function requestSearchRunService(searchId: string) {
    return requestSearchRun(searchId);
}
