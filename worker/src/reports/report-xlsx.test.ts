import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { ReportOpportunity } from "./report-pdf";
import { renderReportXlsx } from "./report-xlsx";

const opportunity: ReportOpportunity = {
    relevance: "muy_relevante",
    matchState: "nueva",
    expediente: "LPN-008-2026",
    title: "“IHSS-GTIC-ADQUISICIÓN DE SOPORTE FUNCIONAL SAP”",
    buyerEntity: "Instituto Hondureño de Seguridad Social (IHSS)",
    modality: "Licitación pública nacional",
    stage: "Recepción de Ofertas",
    startsAt: new Date("2026-09-22T20:46:00Z"),
    // 10:00 in Honduras (UTC-6).
    closesAt: new Date("2026-11-10T16:00:00Z"),
    detailUrl: "https://h1.honducompras.gob.hn/Procesos/x?a=1&b=2",
    reasons: ['Coincide con "soporte funcional SAP" en el Pliego, pág. 3.'],
    documents: ["Aviso de Prensa", "Pliego o Terminos de Referencia"],
};

/** The text of each file in the .xlsx (a zip archive), found through its central directory. */
function unzip(buffer: Buffer) {
    const files = new Map<string, string>();
    const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    let entry = buffer.readUInt32LE(end + 16);
    for (let index = 0; index < buffer.readUInt16LE(end + 10); index++) {
        const method = buffer.readUInt16LE(entry + 10);
        const compressedSize = buffer.readUInt32LE(entry + 20);
        const nameLength = buffer.readUInt16LE(entry + 28);
        const name = buffer.subarray(entry + 46, entry + 46 + nameLength).toString();
        const local = buffer.readUInt32LE(entry + 42);
        const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
        const data = buffer.subarray(start, start + compressedSize);
        files.set(name, (method === 8 ? inflateRawSync(data) : data).toString());
        entry += 46 + nameLength + buffer.readUInt16LE(entry + 30) + buffer.readUInt16LE(entry + 32);
    }
    return files;
}

describe("renderReportXlsx", () => {
    it("writes one sheet per search with unique, valid names", async () => {
        const xlsx = await renderReportXlsx([
            { searchName: "Recomendadas", opportunities: [opportunity] },
            { searchName: "Software: SAP / ERP [IHSS] con un nombre muy largo", opportunities: [] },
            { searchName: "recomendadas", opportunities: [] },
        ]);
        const files = unzip(xlsx);
        const workbook = files.get("xl/workbook.xml") ?? "";
        expect(workbook).toContain('name="Recomendadas"');
        expect(workbook).toContain('name="Software SAP ERP IHSS con un no"');
        expect(workbook).toContain('name="recomendadas (2)"');
    });

    it("writes the opportunity with its title for reading, Honduras time, and a link", async () => {
        const files = unzip(await renderReportXlsx([{ searchName: "Recomendadas", opportunities: [opportunity] }]));
        const text = [...files.values()].join("\n");
        expect(text).toContain("IHSS-GTIC-adquisición de soporte funcional SAP");
        expect(text).toContain("Muy relevante");
        expect(text).toContain('<f>HYPERLINK("https://h1.honducompras.gob.hn/Procesos/x?a=1&amp;b=2","Abrir")</f>');
        // 10 Nov 2026 10:00 as an Excel serial date: days since 1899-12-30 plus the fraction of the day.
        expect(text).toContain("46336.416666");
    });
});
