import { log } from "../log";
import { parseSearchPage, SEARCH_URL } from "./parse";

// An unrecognized User-Agent gets ASP.NET "downlevel" handling and the date
// filter is silently ignored. Never impersonate a specific browser.
const USER_AGENT = "Mozilla/5.0 (compatible; TendersHN/0.1)";
const MIN_GAP_MS = 2_000;
const GAP_JITTER_MS = 1_000;
const REQUEST_TIMEOUT_MS = 60_000;
const RETRY_DELAYS_MS = [5_000, 15_000];
const DOCUMENT_TIMEOUT_MS = 5 * 60_000;
// Supabase Storage's default upload limit.
const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

const GRID_EVENT_TARGET = "ctl00$cphCuerpo$gvResultados";
const PARAMS = "ctl00$cphCuerpo$wpParametros$";

let lastRequestAt = 0;

async function politePause() {
    const gap = MIN_GAP_MS + Math.random() * GAP_JITTER_MS;
    const wait = lastRequestAt + gap - Date.now();
    if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
    }
}

/**
 * One request to the portal, at least 2-3 s after the previous one. Network
 * errors and 5xx responses are retried twice with backoff; the job-level
 * retry handles anything longer. Other responses are returned as they are.
 */
async function send(url: string, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
        await politePause();
        lastRequestAt = Date.now();

        try {
            const response = await fetch(url, {
                ...init,
                headers: { "User-Agent": USER_AGENT, ...init.headers },
                signal: AbortSignal.timeout(timeoutMs),
            });
            if (response.status < 500) {
                return response;
            }
            throw Object.assign(new Error(`HonduCompras returned HTTP ${response.status} for ${url}`), { retryable: true });
        } catch (error) {
            const retryable = error instanceof Error && ("retryable" in error || error.name === "TimeoutError" || error.name === "TypeError");
            const delay = RETRY_DELAYS_MS[attempt];
            if (!retryable || delay === undefined) {
                throw error;
            }
            log("warn", "HonduCompras request failed, retrying", { url, attempt: attempt + 1, retryInMs: delay, error: String(error) });
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
}

async function request(url: string, form?: Record<string, string>): Promise<string> {
    const response = await send(
        url,
        form && {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(form),
        },
    );
    if (!response.ok) {
        throw new Error(`HonduCompras returned HTTP ${response.status} for ${url}`);
    }
    return response.text();
}

/** The DateChooser hidden value, pre-escaped JS-style; the form encoding then encodes it again. */
function dateChooserValue(isoDate: string): string {
    const [year, month, day] = isoDate.split("-").map(Number);
    return escape(`<DateChooser Value="${year}x${month}x${day}"></DateChooser>`);
}

function displayDate(isoDate: string): string {
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
}

/** GETs the search form and submits a start-date window (yyyy-mm-dd). Returns the first results page. */
export async function searchByStartDate(from: string, to: string): Promise<string> {
    const form = parseSearchPage(await request(SEARCH_URL));

    return request(SEARCH_URL, {
        ...form.formFields,
        [`${PARAMS}wdInicio_hidden`]: dateChooserValue(from),
        [`${PARAMS}wdFin_hidden`]: dateChooserValue(to),
        ctl00_cphCuerpo_wpParametros_wdInicio_input: displayDate(from),
        ctl00_cphCuerpo_wpParametros_wdFin_input: displayDate(to),
        [`${PARAMS}btnBuscar`]: "Buscar",
    });
}

/** Posts back a results page's form to move to page `pageNumber`; the date filter is kept in ViewState. */
export function goToResultsPage(formFields: Record<string, string>, pageNumber: number): Promise<string> {
    return request(SEARCH_URL, {
        ...formFields,
        __EVENTTARGET: GRID_EVENT_TARGET,
        __EVENTARGUMENT: `Page$${pageNumber}`,
    });
}

export function fetchDetailPage(detailUrl: string): Promise<string> {
    return request(detailUrl);
}

export interface DocumentValidators {
    etag: string | null;
    lastModified: string | null;
}

export type DocumentResponse =
    | { status: "not_modified" }
    | { status: "unavailable"; reason: string }
    | { status: "downloaded"; bytes: Buffer; mimeType: string; validators: DocumentValidators };

/** Downloads a document file; with validators from a previous download, an unchanged file costs a 304. */
export async function fetchDocument(url: string, previous: DocumentValidators | null): Promise<DocumentResponse> {
    const headers: Record<string, string> = {};
    if (previous?.etag) headers["If-None-Match"] = previous.etag;
    if (previous?.lastModified) headers["If-Modified-Since"] = previous.lastModified;

    const response = await send(url, { headers }, DOCUMENT_TIMEOUT_MS);
    if (response.status === 304) {
        return { status: "not_modified" };
    }
    if (!response.ok) {
        return { status: "unavailable", reason: `HTTP ${response.status}` };
    }
    const declaredBytes = Number(response.headers.get("content-length"));
    if (declaredBytes > MAX_DOCUMENT_BYTES) {
        await response.body?.cancel();
        return { status: "unavailable", reason: `File is ${Math.round(declaredBytes / 1024 / 1024)} MB, over the 50 MB limit` };
    }

    return {
        status: "downloaded",
        bytes: Buffer.from(await response.arrayBuffer()),
        mimeType: response.headers.get("content-type")?.split(";")[0].trim() || "application/octet-stream",
        validators: { etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified") },
    };
}
