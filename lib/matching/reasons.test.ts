import { describe, expect, it } from "vitest";
import { buildReasons, type RetrievedEvidence } from "./reasons";

const fragment = (overrides: Partial<RetrievedEvidence["fragments"][number]>): RetrievedEvidence["fragments"][number] => ({
    document_id: "doc",
    document_version_id: "version",
    document_title: "Pliego LPN-008-2026.pdf",
    page_start: 12,
    page_end: 12,
    matched_terms: [],
    similarity: null,
    ...overrides,
});

const candidate = (overrides: Partial<RetrievedEvidence>): RetrievedEvidence => ({
    field_terms: {},
    matched_unspsc: [],
    object_similarity: null,
    fragments: [],
    ...overrides,
});

describe("buildReasons", () => {
    it("names the field and the document page where each term was found", () => {
        const reasons = buildReasons(
            candidate({
                field_terms: { object: ["soporte funcional SAP"] },
                fragments: [fragment({ matched_terms: ["soporte funcional SAP"] })],
            }),
        );
        expect(reasons.map((reason) => reason.text)).toEqual([
            'Coincide con "soporte funcional SAP" en el objeto.',
            'Coincide con "soporte funcional SAP" en Pliego LPN-008-2026.pdf, pág. 12.',
        ]);
        expect(reasons[1].source).toEqual({ kind: "document", documentId: "doc", documentVersionId: "version", pageStart: 12, pageEnd: 12 });
    });

    it("lists fields in a fixed order and shortens long term lists", () => {
        const reasons = buildReasons(
            candidate({ field_terms: { products: ["asfalto"], object: ["bacheo", "carretera", "pavimento", "asfalto", "calle"] } }),
        );
        expect(reasons.map((reason) => reason.text)).toEqual([
            'Coincide con "bacheo", "carretera", "pavimento" y 2 más en el objeto.',
            'Coincide con "asfalto" en los productos.',
        ]);
    });

    it("shows page ranges and at most three document passages with terms, skipping similar-only passages", () => {
        const reasons = buildReasons(
            candidate({
                fragments: [
                    fragment({ matched_terms: ["SAP"], page_start: 3, page_end: 4 }),
                    fragment({ similarity: 0.8 }),
                    fragment({ matched_terms: ["ERP", "SAP"] }),
                    fragment({ matched_terms: ["SAP"], page_start: 20, page_end: 20 }),
                    fragment({ matched_terms: ["SAP"], page_start: 30, page_end: 30 }),
                ],
            }),
        );
        expect(reasons.map((reason) => reason.text)).toEqual([
            'Coincide con "SAP" en Pliego LPN-008-2026.pdf, págs. 3–4.',
            'Coincide con "ERP" y "SAP" en Pliego LPN-008-2026.pdf, pág. 12.',
            'Coincide con "SAP" en Pliego LPN-008-2026.pdf, pág. 20.',
        ]);
    });

    it("gives one reason per document and page range, and never the same sentence twice", () => {
        const reasons = buildReasons(
            candidate({
                fragments: [
                    fragment({ matched_terms: ["sistemas de información"], page_start: 1, page_end: 1 }),
                    fragment({ matched_terms: ["sistemas de información", "software"], page_start: 1, page_end: 1 }),
                    fragment({ matched_terms: ["SAP"], document_version_id: "other", page_start: 5, page_end: 5 }),
                    fragment({ matched_terms: ["SAP"], document_version_id: "third", page_start: 5, page_end: 5 }),
                ],
            }),
        );
        expect(reasons.map((reason) => reason.text)).toEqual([
            'Coincide con "sistemas de información" y "software" en Pliego LPN-008-2026.pdf, pág. 1.',
            'Coincide con "SAP" en Pliego LPN-008-2026.pdf, pág. 5.',
        ]);
    });

    it("points to the most similar passage when no passage matched a term", () => {
        const reasons = buildReasons(candidate({ fragments: [fragment({ similarity: 0.7 }), fragment({ similarity: 0.6, page_start: 2, page_end: 2 })] }));
        expect(reasons.map((reason) => reason.text)).toEqual(["Un pasaje de Pliego LPN-008-2026.pdf, pág. 12 es similar a lo que ofrece su empresa."]);
    });

    it("names UNSPSC codes", () => {
        expect(buildReasons(candidate({ matched_unspsc: ["43231505"] }))[0].text).toBe("Incluye un producto con el código UNSPSC 43231505.");
        expect(buildReasons(candidate({ matched_unspsc: ["43231505", "43232300", "81112200"] }))[0].text).toBe(
            "Incluye productos con los códigos UNSPSC 43231505, 43232300 y 81112200.",
        );
    });

    it("falls back to object similarity only when nothing else matched", () => {
        expect(buildReasons(candidate({ object_similarity: 0.6 })).map((reason) => reason.text)).toEqual([
            "El objeto del proceso es similar a lo que ofrece su empresa.",
        ]);
        expect(buildReasons(candidate({ object_similarity: 0.6, matched_unspsc: ["43231505"] }))).toHaveLength(1);
        expect(buildReasons(candidate({}))).toEqual([]);
    });
});
