import { describe, expect, it } from "vitest";
import { citationLabel, splitCitations, toCitationMarkup, validateCitations } from "./citations";
import type { ChatSource } from "./schemas";

const processId = "8b0f6d5e-6f0a-4d8e-9a43-3b7b2a1f0c11";

const sources: ChatSource[] = [
    {
        id: "S1",
        kind: "process",
        processId,
        expediente: "LPN-008-2026",
        title: "Soporte SAP",
        url: "https://h1.honducompras.gob.hn/x",
        documentId: null,
        documentVersionId: null,
        pageStart: null,
        pageEnd: null,
        text: "Expediente: LPN-008-2026",
    },
    {
        id: "S2",
        kind: "document",
        processId,
        expediente: "LPN-008-2026",
        title: "Pliego de condiciones",
        url: "https://h1.honducompras.gob.hn/pliego.pdf",
        documentId: "7c1e5d4a-1b2c-4d3e-8f90-112233445566",
        documentVersionId: "9d2f6e5b-2c3d-4e5f-9a01-223344556677",
        pageStart: 12,
        pageEnd: 13,
        text: "La garantía es del 2%",
    },
];

describe("validateCitations", () => {
    it("keeps known ids and lists each cited source once", () => {
        const result = validateCitations("La garantía es del 2% [S2]. Cierra el 12/10 [S1, S2].", sources);
        expect(result.content).toBe("La garantía es del 2% [S2]. Cierra el 12/10 [S1, S2].");
        expect(result.citations.map((citation) => citation.id)).toEqual(["S2", "S1"]);
        expect(result.unverified).toBe(false);
        expect(result.citations[0]).not.toHaveProperty("text");
    });

    it("removes unknown ids and flags the answer", () => {
        const result = validateCitations("Cierra el 12/10 [S1, S9]. El monto es L 1 millón [S7].", sources);
        expect(result.content).toBe("Cierra el 12/10 [S1]. El monto es L 1 millón.");
        expect(result.unknownIds).toEqual(["S9", "S7"]);
        expect(result.unverified).toBe(true);
    });

    it("flags an answer without citations", () => {
        const result = validateCitations("No encuentro ese dato en los documentos.", sources);
        expect(result.citations).toEqual([]);
        expect(result.unverified).toBe(true);
    });
});

describe("splitCitations", () => {
    it("keeps every marker while the answer streams", () => {
        expect(splitCitations("Dato [S2] y otro [S8]", undefined)).toEqual([
            { type: "text", text: "Dato " },
            { type: "citation", ids: ["S2"], citations: [] },
            { type: "text", text: " y otro " },
            { type: "citation", ids: ["S8"], citations: [] },
        ]);
    });

    it("drops markers outside the validated citations", () => {
        const { citations } = validateCitations("x [S2]", sources);
        const parts = splitCitations("Dato [S2, S8] fin [S8]", citations);
        expect(parts).toEqual([
            { type: "text", text: "Dato " },
            { type: "citation", ids: ["S2"], citations },
            { type: "text", text: " fin " },
        ]);
    });
});

describe("citationLabel", () => {
    it("names the document and its pages, or the process", () => {
        const [processSource, documentSource] = validateCitations("[S1] [S2]", sources).citations;
        expect(citationLabel(processSource)).toBe("Ficha del proceso LPN-008-2026");
        expect(citationLabel(documentSource)).toBe("Pliego de condiciones, págs. 12-13");
        expect(citationLabel({ ...documentSource, pageEnd: 12 })).toBe("Pliego de condiciones, pág. 12");
    });
});

describe("toCitationMarkup", () => {
    it("turns each kept marker into a cita tag", () => {
        const { citations } = validateCitations("x [S1] [S2]", sources);
        expect(toCitationMarkup("- Garantía del 2% [S2, S9]\n- Cierra el 12/10 [S1]", citations)).toBe(
            '- Garantía del 2% <cita ids="S2">S2</cita>\n- Cierra el 12/10 <cita ids="S1">S1</cita>',
        );
    });
});
