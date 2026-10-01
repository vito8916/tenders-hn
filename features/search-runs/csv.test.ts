import { describe, expect, it } from "vitest";
import { matchesToCsv } from "./csv";
import type { SearchRunMatch } from "./schemas";

const match: SearchRunMatch = {
    processId: "8b0f6d5e-6f0a-4d8e-9a43-3b7b2a1f0c11",
    processVersionId: null,
    retrievalRank: 1,
    relevance: "muy_relevante",
    matchState: "nueva",
    reasons: [{ text: 'Coincide con "sistemas, redes" en el pliego' }, { text: "Incluye UNSPSC 43231512" }],
    expediente: "LPN-001-2026",
    title: "Soporte funcional SAP\ny licencias",
    buyerEntity: "Instituto Hondureño de Seguridad Social (IHSS)",
    modality: "Licitación pública nacional",
    stage: null,
    closesAt: "2026-11-10T16:00:00.000Z",
    detailUrl: "https://h1.honducompras.gob.hn/x?a=1,2",
    acquisitionType: null,
    startsAt: null,
    detectedAt: "2026-09-22T20:46:00.000Z",
    documentsCount: 3,
};

describe("matchesToCsv", () => {
    it("starts with a BOM and the headers, and writes dates in Honduras time", () => {
        const [header, row] = matchesToCsv([match]).replace("﻿", "").split("\r\n");
        expect(header.startsWith("Relevancia,Estado,Expediente,Objeto")).toBe(true);
        expect(row).toContain("2026-11-10 10:00");
        expect(row).toContain("2026-09-22 14:46");
        expect(matchesToCsv([match]).startsWith("﻿")).toBe(true);
    });

    it("quotes fields with commas, quotes, or line breaks", () => {
        const csv = matchesToCsv([match]);
        expect(csv).toContain('"Soporte funcional SAP\ny licencias"');
        expect(csv).toContain('"Coincide con ""sistemas, redes"" en el pliego | Incluye UNSPSC 43231512"');
        expect(csv).toContain('"https://h1.honducompras.gob.hn/x?a=1,2"');
    });

    it("writes only the headers for no matches", () => {
        expect(matchesToCsv([]).split("\r\n").filter(Boolean)).toHaveLength(1);
    });
});
