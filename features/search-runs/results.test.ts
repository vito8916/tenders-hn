import { describe, expect, it } from "vitest";
import { applyResultView, parseResultView, withParams } from "./results";
import type { SearchRunMatch } from "./schemas";

const match = (overrides: Partial<SearchRunMatch>): SearchRunMatch => ({
    processId: crypto.randomUUID(),
    retrievalRank: 1,
    relevance: "posible",
    matchState: "nueva",
    reasons: [],
    expediente: "LPN-001-2026",
    title: "Soporte funcional SAP",
    buyerEntity: "IHSS",
    modality: "Licitación pública nacional",
    stage: "Recepción de Ofertas",
    closesAt: "2026-10-10T16:00:00.000Z",
    detailUrl: "https://example.test",
    acquisitionType: "Suministro de Bienes y/o Servicios",
    startsAt: "2026-09-20T16:00:00.000Z",
    detectedAt: "2026-09-21T16:00:00.000Z",
    documentsCount: 2,
    ...overrides,
});

const matches = [
    match({ expediente: "A", relevance: "descartada", retrievalRank: 1, closesAt: "2026-10-01T16:00:00.000Z" }),
    match({ expediente: "B", relevance: "muy_relevante", retrievalRank: 2, closesAt: "2026-10-20T16:00:00.000Z", buyerEntity: "Secretaría de Energía" }),
    match({ expediente: "C", relevance: "muy_relevante", retrievalRank: 3, closesAt: "2026-10-05T16:00:00.000Z", documentsCount: 0 }),
    match({ expediente: "D", relevance: "posible", retrievalRank: 4, closesAt: null, matchState: "conocida", title: "Compra de computadoras portátiles" }),
];

describe("parseResultView", () => {
    it("reads repeated facets, drops unknown enum values and bad dates, and defaults the sort and page", () => {
        const view = parseResultView({ relevancia: ["posible", "x"], institucion: "IHSS", cierre_desde: "2026-10-01", cierre_hasta: "mañana", pagina: "-2" });
        expect(view.facets.relevancia).toEqual(["posible"]);
        expect(view.facets.institucion).toEqual(["IHSS"]);
        expect(view.closesFrom).toBe("2026-10-01");
        expect(view.closesTo).toBeNull();
        expect(view.sort).toBe("relevancia");
        expect(view.page).toBe(1);
    });
});

describe("applyResultView", () => {
    it("sorts by relevance, then the soonest deadline", () => {
        const { filtered } = applyResultView(matches, parseResultView({}));
        expect(filtered.map((m) => m.expediente)).toEqual(["C", "B", "D", "A"]);
    });

    it("sorts by deadline with the ones without one last", () => {
        const { filtered } = applyResultView(matches, parseResultView({ orden: "cierre" }));
        expect(filtered.map((m) => m.expediente)).toEqual(["A", "C", "B", "D"]);
    });

    it("searches text without accents or case", () => {
        const { filtered } = applyResultView(matches, parseResultView({ q: "secretaria ENERGIA" }));
        expect(filtered.map((m) => m.expediente)).toEqual(["B"]);
    });

    it("filters by deadline range in Honduras time", () => {
        // 2026-10-05T16:00Z is 10:00 on 5 Oct in Honduras.
        const { filtered } = applyResultView(matches, parseResultView({ cierre_desde: "2026-10-05", cierre_hasta: "2026-10-05" }));
        expect(filtered.map((m) => m.expediente)).toEqual(["C"]);
    });

    it("counts each facet with the other filters applied, keeping values that drop to zero", () => {
        const { filtered, facets } = applyResultView(matches, parseResultView({ relevancia: "muy_relevante", documentos: "con" }));
        expect(filtered.map((m) => m.expediente)).toEqual(["B"]);
        // Relevance counts ignore the relevance filter but apply «con documentos».
        expect(facets.relevancia).toEqual([
            { value: "muy_relevante", count: 1 },
            { value: "posible", count: 1 },
            { value: "descartada", count: 1 },
        ]);
        expect(facets.documentos).toEqual([
            { value: "con", count: 1 },
            { value: "sin", count: 1 },
        ]);
        expect(facets.estado.find((f) => f.value === "conocida")?.count).toBe(0);
    });

    it("pages the filtered rows and clamps a page past the end", () => {
        const many = Array.from({ length: 30 }, (_, index) => match({ expediente: `E${index}`, retrievalRank: index }));
        const result = applyResultView(many, parseResultView({ pagina: "9" }));
        expect(result.pageCount).toBe(2);
        expect(result.page).toBe(2);
        expect(result.rows).toHaveLength(5);
        expect(result.filtered).toHaveLength(30);
    });
});

describe("withParams", () => {
    it("keeps the page when opening a detail and resets it when a filter changes", () => {
        const params = { busqueda: "s", pagina: "2", relevancia: ["posible", "muy_relevante"] };
        expect(withParams(params, { detalle: "p" })).toBe("?busqueda=s&pagina=2&relevancia=posible&relevancia=muy_relevante&detalle=p");
        expect(withParams(params, { relevancia: null })).toBe("?busqueda=s");
    });
});
