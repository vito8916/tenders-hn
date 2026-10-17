import "server-only";
import { z } from "zod";
import { listSavedSearchesService } from "@/features/saved-searches/services";
import type { SavedSearch } from "@/features/saved-searches/schemas";
import { listNotInterestedProcessIdsService } from "@/features/opportunities/services";
import {
    createReportUrl,
    getLatestIngestionAt,
    getHistoryMonths,
    getOrgRun,
    listLatestFinishedRuns,
    listLatestRuns,
    listMatchesForRuns,
    listRunsPage,
    requestSearchRun,
} from "./repository";
import { isRunFinished, type SearchRun, type SearchRunMatch } from "./schemas";
import { composeOpportunities, type HomeView } from "./opportunities";

const HISTORY_PAGE_SIZE = 25;

type HomeItem = { search: SavedSearch; latestRun: SearchRun | null; latestFinished: SearchRun | null };

const runMatches = (item: HomeItem & { latestFinished: SearchRun }, matchesByRun: Map<string, SearchRunMatch[]>) => ({
    searchId: item.search.id,
    runId: item.latestFinished.id,
    isDefault: item.search.isDefault,
    matches: matchesByRun.get(item.latestFinished.id) ?? [],
});

/**
 * What an opportunities page shows (plan D7, spec 0.4 §12.1): the organization's searches («Recomendadas»
 * first, then the lists by name) with each one's latest and latest finished run, the views over the finished
 * runs of the active ones, and for an update's page that run with its frozen matches. A run in progress never
 * replaces finished results. Null when the list or the update is not the organization's, or the update has
 * not finished. The default search's list is Recomendadas.
 */
export async function getHomeService(params: { orgId: string; view: HomeView }) {
    const requestedRun =
        params.view.kind === "update" ? (z.uuid().safeParse(params.view.runId).success ? await getOrgRun(params.orgId, params.view.runId) : null) : undefined;
    if (requestedRun === null || (requestedRun && !isRunFinished(requestedRun.run.status))) return null;
    if (params.view.kind === "lista" && !z.uuid().safeParse(params.view.searchId).success) return null;

    const [searches, latestRuns, finishedRuns, latestIngestionAt, notInterested] = await Promise.all([
        listSavedSearchesService(params.orgId),
        listLatestRuns(params.orgId),
        listLatestFinishedRuns(params.orgId),
        getLatestIngestionAt(),
        listNotInterestedProcessIdsService(params.orgId),
    ]);

    const latestBySearch = new Map(latestRuns.map((run) => [run.savedSearchId, run]));
    const finishedBySearch = new Map(finishedRuns.map((run) => [run.savedSearchId, run]));
    // Searches come sorted by name and the sort is stable.
    const items: HomeItem[] = searches
        .map((search) => ({ search, latestRun: latestBySearch.get(search.id) ?? null, latestFinished: finishedBySearch.get(search.id) ?? null }))
        .sort((a, b) => Number(b.search.isDefault) - Number(a.search.isDefault));
    const defaultItem = items.find((item) => item.search.isDefault) ?? null;

    const snapshot = requestedRun?.run ?? null;
    const requestedId = params.view.kind === "lista" ? params.view.searchId : (snapshot?.savedSearchId ?? null);
    const requestedItem = items.find((item) => item.search.id === requestedId);
    if (requestedId && !requestedItem) return null;
    const view: HomeView = params.view.kind === "lista" && requestedItem?.search.isDefault ? { kind: "recomendadas" } : params.view;

    const finished = items.filter((item): item is HomeItem & { latestFinished: SearchRun } => item.latestFinished !== null);
    const active = finished.filter((item) => item.search.isActive);
    // A paused list is left out of Todas and Descartadas but still shows its own last results.
    const pausedShown = view.kind === "lista" ? finished.find((item) => item.search.id === requestedId && !item.search.isActive) : undefined;

    const matchesByRun = await listMatchesForRuns([
        ...active.map((item) => item.latestFinished.id),
        ...(pausedShown ? [pausedShown.latestFinished.id] : []),
        ...(snapshot ? [snapshot.id] : []),
    ]);
    const now = new Date();
    const opportunities = composeOpportunities({ runs: active.map((item) => runMatches(item, matchesByRun)), notInterested, now });
    if (pausedShown) {
        const paused = composeOpportunities({ runs: [runMatches(pausedShown, matchesByRun)], notInterested, now });
        opportunities.byList.set(pausedShown.search.id, paused.byList.get(pausedShown.search.id) ?? []);
    }

    const viewItem =
        view.kind === "recomendadas" ? defaultItem : view.kind === "lista" || view.kind === "update" ? (requestedItem ?? null) : null;

    return {
        items,
        view,
        viewItem,
        defaultItem,
        opportunities,
        snapshot: snapshot
            ? {
                  run: snapshot,
                  matches: (matchesByRun.get(snapshot.id) ?? []).map((match) => ({ ...match, runId: snapshot.id, searchId: snapshot.savedSearchId })),
              }
            : null,
        latestIngestionAt,
    };
}

export type HomeData = NonNullable<Awaited<ReturnType<typeof getHomeService>>>;

/** The rows of the view: the page's table and its CSV download read the same ones. */
export function homeViewRows(home: HomeData) {
    const { view, opportunities, snapshot } = home;
    switch (view.kind) {
        case "recomendadas":
            return opportunities.recomendadas;
        case "todas":
            return opportunities.todas;
        case "descartadas":
            return opportunities.descartadas;
        case "lista":
            return opportunities.byList.get(view.searchId) ?? [];
        case "update":
            return snapshot?.matches ?? [];
    }
}

/** «licitaly-<view>-<yyyy-mm-dd>»: the name of a view's CSV; a snapshot keeps its run's date. */
export function homeViewFileName(home: HomeData) {
    const { view, viewItem, snapshot } = home;
    const name = view.kind === "todas" ? "Todas" : view.kind === "descartadas" ? "Descartadas" : (viewItem?.search.name ?? "oportunidades");
    return runFileName(name, snapshot?.run.createdAt ?? new Date().toISOString());
}

/** The history (spec 0.4 §12.4): a page of the organization's updates, of Recomendadas and every list, and how many months the plan keeps. */
export async function getRunHistoryService(params: { orgId: string; page: number }) {
    const [{ runs, total }, historyMonths, searches] = await Promise.all([
        listRunsPage(params.orgId, params.page, HISTORY_PAGE_SIZE),
        getHistoryMonths(params.orgId),
        listSavedSearchesService(params.orgId),
    ]);
    const searchById = new Map(searches.map((search) => [search.id, search]));
    return {
        runs: runs.map((run) => ({ ...run, search: searchById.get(run.savedSearchId) ?? null })),
        historyMonths,
        pageCount: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)),
    };
}

const fileDate = new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeZone: "America/Tegucigalpa" });

/** «licitaly-<search>-<yyyy-mm-dd>»: the name of a run's downloads. */
export function runFileName(searchName: string, createdAt: string) {
    const slug = searchName
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    return `licitaly-${slug}-${fileDate.format(new Date(createdAt))}`;
}

/** A link to the run's frozen PDF, or null when the run is not the organization's or the PDF is not ready. */
export async function getRunReportUrlService(params: { orgId: string; runId: string }) {
    if (!z.uuid().safeParse(params.runId).success) return null;
    const found = await getOrgRun(params.orgId, params.runId);
    if (!found?.run.reportPath) return null;
    return createReportUrl(found.run.reportPath, `${runFileName(found.searchName, found.run.createdAt)}.pdf`);
}

/** A link to the run's Excel file, or null when the run is not the organization's or the file is not ready. */
export async function getRunExcelUrlService(params: { orgId: string; runId: string }) {
    if (!z.uuid().safeParse(params.runId).success) return null;
    const found = await getOrgRun(params.orgId, params.runId);
    if (!found?.run.excelPath) return null;
    return createReportUrl(found.run.excelPath, `${runFileName(found.searchName, found.run.createdAt)}.xlsx`);
}

/** Any member runs an active search; request_search_run enforces it. */
export async function requestSearchRunService(searchId: string) {
    return requestSearchRun(searchId);
}
