import { describe, expect, it } from "vitest";
import { renderReportPdf, type ReportData } from "./report-pdf";

const data: ReportData = {
    orgName: "Colmena",
    searchName: "Software y sistemas",
    runCreatedAt: new Date("2026-09-30T16:00:00Z"),
    generatedAt: new Date("2026-09-30T16:05:00Z"),
    sourceSyncedAt: new Date("2026-09-30T15:00:00Z"),
    processesExamined: 412,
    candidates: 100,
    failedEvaluations: 2,
    counts: { muy_relevante: 1, posible: 1, pendiente: 0, descartada: 98 },
    opportunities: Array.from({ length: 12 }, (_, index) => ({
        relevance: index === 0 ? ("muy_relevante" as const) : ("posible" as const),
        matchState: "nueva" as const,
        expediente: `LPN-${index}-2026`,
        title: "“IHSS-GTIC-ADQUISICIÓN DE SOPORTE FUNCIONAL SAP” ≥ año",
        buyerEntity: "Instituto Hondureño de Seguridad Social (IHSS)",
        modality: "Licitación pública nacional",
        stage: "Recepción de Ofertas",
        startsAt: new Date("2026-09-22T20:46:00Z"),
        closesAt: index === 1 ? null : new Date("2026-11-10T16:00:00Z"),
        detailUrl: "https://h1.honducompras.gob.hn/x",
        reasons: ['Coincide con "soporte funcional SAP" en el Pliego, pág. 3.'],
        documents: index === 2 ? [] : ["Aviso de Prensa", "Pliego o Terminos de Referencia"],
    })),
};

describe("renderReportPdf", () => {
    it("renders a multi-page PDF, including characters outside the built-in font", async () => {
        const pdf = await renderReportPdf(data);
        expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
        expect(pdf.length).toBeGreaterThan(5_000);
        expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    });

    it("renders a run without opportunities", async () => {
        const pdf = await renderReportPdf({ ...data, failedEvaluations: 0, opportunities: [] });
        expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    });
});
