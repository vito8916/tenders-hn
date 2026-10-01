import { MatchStateSchema, RelevanceSchema, type MatchState, type Relevance, type SearchRunMatch } from "./schemas";

/**
 * The results table's view of a run (spec §12.2): filters, facets with
 * counts, sorting, and pages, read from and written to the URL. A run keeps
 * at most a hundred candidates, so this runs in memory on the server, and the
 * CSV download applies the same view. It never touches the saved search.
 */

export const PAGE_SIZE = 25;

export const RELEVANCE_LABELS: Record<Relevance, string> = {
    muy_relevante: "Muy relevante",
    posible: "Posible",
    pendiente: "Pendiente",
    descartada: "Descartada",
};
const RELEVANCE_ORDER = Object.keys(RELEVANCE_LABELS) as Relevance[];

export const MATCH_STATE_LABELS: Record<MatchState, string> = { nueva: "Nueva", actualizada: "Actualizada", conocida: "Conocida" };

export const RESULT_SORTS = { relevancia: "Relevancia", cierre: "Fecha límite", inicio: "Fecha de inicio", institucion: "Institución", deteccion: "Fecha de detección" } as const;
export type ResultSort = keyof typeof RESULT_SORTS;

/** The facets (spec §12.2), keyed by their URL parameter. */
export const FACETS = {
    relevancia: { label: "Relevancia", value: (match: SearchRunMatch) => match.relevance as string | null },
    estado: { label: "Estado", value: (match: SearchRunMatch) => match.matchState as string | null },
    institucion: { label: "Institución", value: (match: SearchRunMatch) => match.buyerEntity as string | null },
    modalidad: { label: "Modalidad", value: (match: SearchRunMatch) => match.modality },
    etapa: { label: "Etapa", value: (match: SearchRunMatch) => match.stage },
    tipo: { label: "Tipo de adquisición", value: (match: SearchRunMatch) => match.acquisitionType },
    documentos: { label: "Documentos", value: (match: SearchRunMatch) => (match.documentsCount > 0 ? "con" : "sin") },
} as const;
export type FacetKey = keyof typeof FACETS;
const FACET_KEYS = Object.keys(FACETS) as FacetKey[];

export const DOCUMENTS_LABELS: Record<string, string> = { con: "Con documentos", sin: "Sin documentos" };

/** How a facet value reads in the filters and on the page. */
export function facetValueLabel(facet: FacetKey, value: string) {
    if (facet === "relevancia") return RELEVANCE_LABELS[value as Relevance] ?? value;
    if (facet === "estado") return MATCH_STATE_LABELS[value as MatchState] ?? value;
    if (facet === "documentos") return DOCUMENTS_LABELS[value] ?? value;
    return value;
}

export type ResultView = {
    q: string;
    facets: Record<FacetKey, string[]>;
    /** yyyy-mm-dd, Honduras time. */
    closesFrom: string | null;
    closesTo: string | null;
    sort: ResultSort;
    page: number;
};

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

const all = (value: string | string[] | undefined) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const first = (value: string | string[] | undefined) => all(value)[0];
const isDate = (value: string | undefined): value is string => value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value);

export function parseResultView(params: SearchParamsRecord): ResultView {
    const facets = Object.fromEntries(FACET_KEYS.map((key) => [key, all(params[key]).filter(Boolean)])) as Record<FacetKey, string[]>;
    facets.relevancia = facets.relevancia.filter((value) => RelevanceSchema.safeParse(value).success);
    facets.estado = facets.estado.filter((value) => MatchStateSchema.safeParse(value).success);

    const sort = first(params.orden);
    const page = Number.parseInt(first(params.pagina) ?? "1");
    const closesFrom = first(params.cierre_desde);
    const closesTo = first(params.cierre_hasta);
    return {
        q: (first(params.q) ?? "").trim(),
        facets,
        closesFrom: isDate(closesFrom) ? closesFrom : null,
        closesTo: isDate(closesTo) ? closesTo : null,
        sort: sort && sort in RESULT_SORTS ? (sort as ResultSort) : "relevancia",
        page: Number.isFinite(page) && page > 0 ? page : 1,
    };
}

/** True when anything narrows the results; the sort and page do not. */
export const hasFilters = (view: ResultView) =>
    view.q !== "" || view.closesFrom !== null || view.closesTo !== null || FACET_KEYS.some((key) => view.facets[key].length > 0);

const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function passes(match: SearchRunMatch, view: ResultView, exceptFacet?: FacetKey) {
    if (view.q) {
        const haystack = normalize([match.expediente, match.title, match.buyerEntity, ...match.reasons.map((reason) => reason.text)].join(" "));
        if (!normalize(view.q).split(/\s+/).every((word) => haystack.includes(word))) return false;
    }
    // Honduras has no daylight saving time: its offset is always -06:00.
    if (view.closesFrom && (!match.closesAt || new Date(match.closesAt) < new Date(`${view.closesFrom}T00:00:00-06:00`))) return false;
    if (view.closesTo && (!match.closesAt || new Date(match.closesAt) > new Date(`${view.closesTo}T23:59:59.999-06:00`))) return false;

    return FACET_KEYS.every((key) => {
        const selected = view.facets[key];
        if (key === exceptFacet || selected.length === 0) return true;
        const value = FACETS[key].value(match);
        return value !== null && selected.includes(value);
    });
}

const byDate = (a: string | null, b: string | null, direction: 1 | -1) => {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a < b ? -direction : direction;
};

const COMPARATORS: Record<ResultSort, (a: SearchRunMatch, b: SearchRunMatch) => number> = {
    // Within each level, the ones closing soonest first (plan, Phase 3).
    relevancia: (a, b) =>
        RELEVANCE_ORDER.indexOf(a.relevance) - RELEVANCE_ORDER.indexOf(b.relevance) ||
        byDate(a.closesAt, b.closesAt, 1) ||
        a.retrievalRank - b.retrievalRank,
    cierre: (a, b) => byDate(a.closesAt, b.closesAt, 1) || a.retrievalRank - b.retrievalRank,
    inicio: (a, b) => byDate(a.startsAt, b.startsAt, -1) || a.retrievalRank - b.retrievalRank,
    institucion: (a, b) => a.buyerEntity.localeCompare(b.buyerEntity, "es") || a.retrievalRank - b.retrievalRank,
    deteccion: (a, b) => byDate(a.detectedAt, b.detectedAt, -1) || a.retrievalRank - b.retrievalRank,
};

export type FacetCounts = Record<FacetKey, { value: string; count: number }[]>;

/**
 * The run's matches under a view: every filtered row in order (for the CSV),
 * the current page, and each facet's values with how many rows each would
 * give with the other filters applied.
 */
export function applyResultView(matches: SearchRunMatch[], view: ResultView) {
    const filtered = matches.filter((match) => passes(match, view)).sort(COMPARATORS[view.sort]);
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const page = Math.min(view.page, pageCount);

    const facets = Object.fromEntries(
        FACET_KEYS.map((key) => {
            const counts = new Map<string, number>();
            for (const match of matches) {
                const value = FACETS[key].value(match);
                if (value !== null && !counts.has(value)) counts.set(value, 0);
            }
            for (const match of matches) {
                const value = FACETS[key].value(match);
                if (value !== null && passes(match, view, key)) counts.set(value, (counts.get(value) ?? 0) + 1);
            }
            const values = [...counts].map(([value, count]) => ({ value, count }));
            if (key === "relevancia") values.sort((a, b) => RELEVANCE_ORDER.indexOf(a.value as Relevance) - RELEVANCE_ORDER.indexOf(b.value as Relevance));
            else if (key === "estado") values.sort((a, b) => Object.keys(MATCH_STATE_LABELS).indexOf(a.value) - Object.keys(MATCH_STATE_LABELS).indexOf(b.value));
            else values.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "es"));
            return [key, values];
        }),
    ) as FacetCounts;

    return {
        filtered,
        rows: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        page,
        pageCount,
        facets,
    };
}

/** The parameters that narrow or order the results: changing any of them goes back to the first page. */
export const VIEW_PARAMS = [...FACET_KEYS, "q", "cierre_desde", "cierre_hasta", "orden"];

/** The current URL's query with some parameters replaced (null removes one). */
export function withParams(params: SearchParamsRecord, changes: Record<string, string | string[] | null>) {
    const resetsPage = Object.keys(changes).some((key) => VIEW_PARAMS.includes(key));
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (key in changes || (key === "pagina" && resetsPage)) continue;
        for (const item of all(value)) query.append(key, item);
    }
    for (const [key, value] of Object.entries(changes)) {
        for (const item of value === null ? [] : Array.isArray(value) ? value : [value]) query.append(key, item);
    }
    return `?${query}`;
}
