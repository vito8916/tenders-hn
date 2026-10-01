import PDFDocument from "pdfkit";

export type ReportRelevance = "muy_relevante" | "posible" | "pendiente" | "descartada";

export interface ReportOpportunity {
    relevance: ReportRelevance;
    matchState: "nueva" | "actualizada" | "conocida" | null;
    expediente: string;
    title: string;
    buyerEntity: string;
    modality: string | null;
    stage: string | null;
    startsAt: Date | null;
    closesAt: Date | null;
    detailUrl: string;
    reasons: string[];
    /** Titles of the documents published when the run evaluated it. */
    documents: string[];
}

export interface ReportData {
    orgName: string;
    searchName: string;
    runCreatedAt: Date;
    generatedAt: Date;
    sourceSyncedAt: Date | null;
    processesExamined: number | null;
    candidates: number | null;
    failedEvaluations: number;
    counts: Record<ReportRelevance, number>;
    /** Muy relevantes, posibles, and pendientes, in that order. */
    opportunities: ReportOpportunity[];
}

const RELEVANCE_LABELS: Record<ReportRelevance, string> = {
    muy_relevante: "Muy relevante",
    posible: "Posible",
    pendiente: "Pendiente de revisión",
    descartada: "Descartada",
};

const dateTime = new Intl.DateTimeFormat("es-HN", { dateStyle: "long", timeStyle: "short", timeZone: "America/Tegucigalpa" });
const formatDate = (value: Date | null) => (value ? dateTime.format(value) : "No publicada");

// The built-in Helvetica covers Windows-1252: Spanish letters, «», curly quotes, and dashes. Anything else would print as garbage.
const WIN_ANSI_EXTRAS = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const printable = (text: string) =>
    [...text.normalize("NFC")].map((char) => (char.charCodeAt(0) < 256 || WIN_ANSI_EXTRAS.has(char) ? char : "?")).join("");

const MUTED = "#555555";
const LINK = "#1d4ed8";

/**
 * The frozen report of a run (spec §7): a header with when it was generated
 * and the source's last sync, a summary, and one section per opportunity
 * with its dates, stage, relevance, reasons, documents considered, and the
 * official link, plus a visible note when the analysis was partial or a
 * process had no documents.
 */
export function renderReportPdf(data: ReportData): Promise<Buffer> {
    const doc = new PDFDocument({
        size: "LETTER",
        margins: { top: 56, bottom: 56, left: 56, right: 56 },
        bufferPages: true,
        info: { Title: printable(`Reporte: ${data.searchName}`), Author: "Tenders HN" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

    const text = (value: string, options?: PDFKit.Mixins.TextOptions) => doc.text(printable(value), options);

    // Header
    doc.font("Helvetica").fontSize(9).fillColor(MUTED);
    text(`Tenders HN · ${data.orgName}`);
    doc.moveDown(0.3).font("Helvetica-Bold").fontSize(18).fillColor("black");
    text(data.searchName);
    doc.moveDown(0.3).font("Helvetica").fontSize(9).fillColor(MUTED);
    text(`Ejecución del ${formatDate(data.runCreatedAt)} · Generado el ${formatDate(data.generatedAt)}`);
    text(
        data.sourceSyncedAt
            ? `Datos de HonduCompras sincronizados el ${formatDate(data.sourceSyncedAt)}`
            : "Sin fecha de sincronización registrada para esta ejecución",
    );

    // Summary
    doc.moveDown().font("Helvetica-Bold").fontSize(12).fillColor("black");
    text("Resumen");
    doc.moveDown(0.3).font("Helvetica").fontSize(10);
    text(
        `Se examinaron ${data.processesExamined ?? 0} procesos abiertos y se evaluaron ${data.candidates ?? 0} candidatos: ` +
            `${data.counts.muy_relevante} muy relevantes, ${data.counts.posible} posibles, ${data.counts.pendiente} pendientes de revisión ` +
            `y ${data.counts.descartada} descartados.`,
    );
    if (data.failedEvaluations > 0) {
        doc.moveDown(0.3).fillColor("#b45309");
        text(
            `Análisis parcial: ${data.failedEvaluations} candidatos no se pudieron evaluar y aparecen como «Pendiente de revisión». Revíselos en la plataforma.`,
        );
        doc.fillColor("black");
    }
    if (data.opportunities.length === 0) {
        doc.moveDown();
        text("Esta ejecución no encontró oportunidades relevantes.");
    }

    // One section per opportunity
    for (const opportunity of data.opportunities) {
        doc.moveDown(1.2);
        if (doc.y > doc.page.height - 200) doc.addPage();

        doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED);
        const state = opportunity.matchState === "nueva" ? " · Nueva" : opportunity.matchState === "actualizada" ? " · Actualizada" : "";
        text(`${RELEVANCE_LABELS[opportunity.relevance].toUpperCase()}${state} · ${opportunity.expediente}`);
        doc.moveDown(0.2).font("Helvetica-Bold").fontSize(11).fillColor("black");
        text(opportunity.title);
        doc.moveDown(0.2).font("Helvetica").fontSize(9.5);
        text(opportunity.buyerEntity);
        doc.fillColor(MUTED);
        text([opportunity.modality, opportunity.stage].filter(Boolean).join(" · ") || "Modalidad y etapa no publicadas");
        doc.fillColor("black");
        text(`Fecha límite: ${formatDate(opportunity.closesAt)}${opportunity.startsAt ? ` · Inicio: ${formatDate(opportunity.startsAt)}` : ""}`);

        if (opportunity.reasons.length > 0) {
            doc.moveDown(0.3).font("Helvetica-Bold");
            text("Motivos");
            doc.font("Helvetica");
            doc.list(opportunity.reasons.map(printable), { bulletRadius: 1.5, textIndent: 10 });
        }

        doc.moveDown(0.3).font("Helvetica-Bold");
        text("Documentos considerados");
        doc.font("Helvetica");
        if (opportunity.documents.length > 0) {
            doc.list(opportunity.documents.map(printable), { bulletRadius: 1.5, textIndent: 10 });
        } else {
            doc.fillColor("#b45309");
            text("Sin documentos publicados: el análisis usó solo el detalle del proceso.");
            doc.fillColor("black");
        }

        doc.moveDown(0.3).fillColor(LINK);
        text("Ver en HonduCompras", { link: opportunity.detailUrl, underline: true });
        doc.fillColor("black");
    }

    // Page numbers, written without moving into the bottom margin.
    const range = doc.bufferedPageRange();
    for (let index = 0; index < range.count; index++) {
        doc.switchToPage(range.start + index);
        const bottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.font("Helvetica").fontSize(8).fillColor(MUTED);
        doc.text(`Página ${index + 1} de ${range.count}`, doc.page.margins.left, doc.page.height - 36, {
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
            align: "center",
        });
        doc.page.margins.bottom = bottom;
    }

    doc.end();
    return finished;
}
