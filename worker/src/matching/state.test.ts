import { describe, expect, it } from "vitest";
import { buildState, type Fragment, type ProcessForState } from "./state";

const profile = { description: "Soporte funcional SAP y licencias de software.", offerings: ["SAP", "ERP"], exclusions: [] };
const match = { terms: ["SAP"], fields: ["object", "documents"], unspsc: ["43231505"] };
const process: ProcessForState = {
    expediente: "LPN-008-2026",
    title: "Contratación de soporte funcional SAP",
    buyerEntity: "IHSS",
    purchaseUnit: "Gerencia de Tecnología",
    modality: "Licitación Pública Nacional",
    acquisitionType: "Servicios",
    stage: "Recepción de Ofertas",
    closesAt: "2026-10-15T16:00:00.000Z",
    products: [{ unspsc: "43231505", description: "Software de recursos humanos", specifications: "x".repeat(2_000), quantity: 1 }],
    documentCount: 3,
};
const fragment = (chunkId: number, chars: number): Fragment => ({
    chunkId,
    documentTitle: "Pliego",
    pageStart: 12,
    pageEnd: chunkId === 1 ? 12 : 13,
    content: "a".repeat(chars),
});

describe("buildState", () => {
    it("labels fragments by file and page and caps long specifications", () => {
        const { state, evidence } = buildState({ profile, process, match, fragments: [fragment(1, 100), fragment(2, 100)] });

        expect(state.fragmentos).toEqual([
            { archivo: "Pliego", paginas: "12", texto: "a".repeat(100) },
            { archivo: "Pliego", paginas: "12-13", texto: "a".repeat(100) },
        ]);
        expect(state.proceso).toMatchObject({ entidad: "IHSS · Gerencia de Tecnología", documentos: "3 documento(s); fragmentos abajo" });
        expect(JSON.stringify(state)).not.toContain("x".repeat(601));
        expect(state.empresa).not.toHaveProperty("no_desea");
        expect(evidence).toMatchObject({ fragmentIds: [1, 2], fragmentsLeftOut: 0, productsLeftOut: 0 });
    });

    it("keeps fragments in retrieval order within the budget and records what it left out", () => {
        const { evidence } = buildState({
            profile,
            process,
            match,
            fragments: [fragment(1, 3_000), fragment(2, 30_000), fragment(3, 3_000)],
            budgetTokens: 3_000,
        });

        expect(evidence.fragmentIds).toEqual([1, 3]);
        expect(evidence.fragmentsLeftOut).toBe(1);
        expect(evidence.estimatedTokens).toBeLessThanOrEqual(3_000);
    });

    it("says when a process has no documents and lists exclusions", () => {
        const { state } = buildState({
            profile: { ...profile, exclusions: ["equipo médico"] },
            process: { ...process, documentCount: 0, products: [] },
            match,
            fragments: [],
        });

        expect(state.proceso).toMatchObject({ documentos: "El proceso no tiene documentos publicados", productos: [] });
        expect(state.empresa).toMatchObject({ no_desea: ["equipo médico"] });
    });
});
