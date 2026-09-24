import { log } from "../log";
import { parseSearchPage, SEARCH_URL } from "./parse";

// An unrecognized User-Agent gets ASP.NET "downlevel" handling and the date
// filter is silently ignored. Never impersonate a specific browser.
const USER_AGENT = "Mozilla/5.0 (compatible; TendersHN/0.1)";
const MIN_GAP_MS = 2_000;
const GAP_JITTER_MS = 1_000;
const REQUEST_TIMEOUT_MS = 60_000;
const RETRY_DELAYS_MS = [5_000, 15_000];

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
 * retry handles anything longer.
 */
async function request(url: string, form?: Record<string, string>): Promise<string> {
    for (let attempt = 0; ; attempt++) {
        await politePause();
        lastRequestAt = Date.now();

        try {
            const response = await fetch(url, {
                method: form ? "POST" : "GET",
                headers: {
                    "User-Agent": USER_AGENT,
                    ...(form && { "Content-Type": "application/x-www-form-urlencoded" }),
                },
                body: form && new URLSearchParams(form),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });

            if (response.ok) {
                return await response.text();
            }
            if (response.status < 500) {
                throw new Error(`HonduCompras returned HTTP ${response.status} for ${url}`);
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
