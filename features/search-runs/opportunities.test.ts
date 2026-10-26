import { describe, expect, it } from "vitest";
import { composeOpportunities, homeViewPath, type RunMatches } from "./opportunities";
import type { TrackedState } from "@/features/opportunities/schemas";
import type { Opportunity } from "./opportunities";
import type { SearchRunMatch } from "./schemas";

const now = new Date("2026-10-16T12:00:00.000Z");
const searchA = "00000000-0000-4000-8000-00000000000a";
const searchB = "00000000-0000-4000-8000-00000000000b";
const runA = "00000000-0000-4000-8000-0000000000a1";
const runB = "00000000-0000-4000-8000-0000000000b1";

const match = (processId: string, overrides: Partial<SearchRunMatch> = {}): SearchRunMatch => ({
    processId,
    processVersionId: null,
    retrievalRank: 1,
    relevance: "posible",
    matchState: "conocida",
    reasons: [],
    expediente: processId,
    title: "Soporte funcional SAP",
    buyerEntity: "IHSS",
    modality: null,
    stage: null,
    closesAt: "2026-10-30T16:00:00.000Z",
    detailUrl: "https://example.test",
    acquisitionType: null,
    startsAt: null,
    detectedAt: null,
    documentsCount: 0,
    ...overrides,
});

const ids = (rows: { processId: string }[]) => rows.map((row) => row.processId).sort();

describe("homeViewPath", () => {
    it("gives each view its own path", () => {
        expect(homeViewPath("acme", { kind: "recomendadas" })).toBe("/organizations/acme/opportunities/recommended");
        expect(homeViewPath("acme", { kind: "todas" })).toBe("/organizations/acme/opportunities/all");
        expect(homeViewPath("acme", { kind: "descartadas" })).toBe("/organizations/acme/opportunities/discarded");
        expect(homeViewPath("acme", { kind: "lista", searchId: searchA })).toBe(`/organizations/acme/lists/${searchA}`);
        expect(homeViewPath("acme", { kind: "update", runId: runA })).toBe(`/organizations/acme/updates/${runA}`);
    });
});

describe("composeOpportunities", () => {
    const runs: RunMatches[] = [
        {
            searchId: searchA,
            runId: runA,
            isDefault: true,
            matches: [
                match("muy", { relevance: "muy_relevante" }),
                match("posible"),
                match("pendiente", { relevance: "pendiente" }),
                match("descartada-en-ambas", { relevance: "descartada" }),
                match("descartada-solo-aqui", { relevance: "descartada" }),
                match("cerrada", { relevance: "muy_relevante", closesAt: "2026-10-01T16:00:00.000Z" }),
                match("no-interesa", { relevance: "muy_relevante" }),
                match("en-ambas", { relevance: "posible", matchState: "conocida" }),
                match("evaluando", { relevance: "posible" }),
                match("rescatada", { relevance: "descartada" }),
                match("presentada-cerrada", { relevance: "muy_relevante", closesAt: "2026-10-10T16:00:00.000Z" }),
            ],
        },
        {
            searchId: searchB,
            runId: runB,
            isDefault: false,
            matches: [
                match("descartada-en-ambas", { relevance: "descartada" }),
                match("descartada-solo-aqui", { relevance: "muy_relevante" }),
                match("en-ambas", { relevance: "muy_relevante", matchState: "actualizada" }),
            ],
        },
    ];
    const state = (status: TrackedState["status"]): TrackedState => ({ status, assigneeId: null, assigneeName: null });
    const tracking = new Map<string, TrackedState>([
        ["no-interesa", state("descartada")],
        ["evaluando", state("en_evaluacion")],
        ["rescatada", state("en_evaluacion")],
        ["presentada-cerrada", state("presentada")],
        ["ganada-antes", state("ganada")],
    ]);
    // A process an older run found, which the latest runs no longer have.
    const tracked: Opportunity[] = [{ ...match("ganada-antes", { closesAt: "2026-09-01T16:00:00.000Z" }), runId: "old", searchId: searchA, tracking: state("ganada") }];
    const views = composeOpportunities({ runs, tracking, tracked, now });

    it("keeps only the default search's muy relevantes in Recomendadas, open and not discarded by the team", () => {
        expect(ids(views.recomendadas)).toEqual(["muy"]);
    });

    it("lists every search's results but the discarded ones in Todas, once per process", () => {
        expect(ids(views.todas)).toEqual(["descartada-solo-aqui", "en-ambas", "evaluando", "muy", "pendiente", "posible"]);
        expect(views.todas.filter((row) => row.processId === "en-ambas")).toHaveLength(1);
    });

    it("keeps the most relevant row, with its run, and the most recent novelty", () => {
        const inBoth = views.todas.find((row) => row.processId === "en-ambas");
        expect(inBoth).toMatchObject({ relevance: "muy_relevante", runId: runB, searchId: searchB, matchState: "actualizada" });
    });

    it("puts in Nuevas what in Todas nobody has acted on", () => {
        expect(ids(views.nuevas)).toEqual(["descartada-solo-aqui", "en-ambas", "muy", "pendiente", "posible"]);
    });

    it("keeps in En seguimiento every tracked status but descartada, closed, discarded by Licitaly, or from an older run", () => {
        expect(ids(views.seguimiento)).toEqual(["evaluando", "ganada-antes", "presentada-cerrada", "rescatada"]);
        expect(views.seguimiento.find((row) => row.processId === "evaluando")?.tracking?.status).toBe("en_evaluacion");
    });

    it("puts in Descartadas what every run discarded and what the team discarded, but not what the team tracks", () => {
        expect(ids(views.descartadas)).toEqual(["descartada-en-ambas", "no-interesa"]);
    });

    it("gives each list its own results but the discarded ones", () => {
        expect(ids(views.byList.get(searchB) ?? [])).toEqual(["descartada-solo-aqui", "en-ambas"]);
    });
});
