import "server-only";
import { getLatestIngestionAt, getLatestRuns, listLatestRuns, listSearchRunMatches, requestSearchRun } from "./repository";

export async function listLatestRunsService(orgId: string) {
    return listLatestRuns(orgId);
}

/** What a search's page shows: its latest run, the finished run whose results are listed, and the ingestion a new run would use. */
export async function getSearchResultsService(searchId: string) {
    const [{ latest, finished }, latestIngestionAt] = await Promise.all([getLatestRuns(searchId), getLatestIngestionAt()]);
    const matches = finished ? await listSearchRunMatches(finished.id) : [];
    return { latestRun: latest, shownRun: finished, matches, latestIngestionAt };
}

/** Any member runs an active search; request_search_run enforces it. */
export async function requestSearchRunService(searchId: string) {
    return requestSearchRun(searchId);
}
