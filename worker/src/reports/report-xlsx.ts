import writeXlsxFile, { type Cell, type Row, type Sheet } from "write-excel-file/node";
import { formatOpportunityTitle } from "@/features/opportunities/title";
import type { ReportOpportunity, ReportRelevance } from "./report-pdf";

export interface XlsxSheet {
    /** The search's name; Excel limits sheet names to 31 characters without []:*?/\ and unique in the file. */
    searchName: string;
    /** Muy relevantes, posibles, and pendientes, in that order. */
    opportunities: ReportOpportunity[];
}

const RELEVANCE_LABELS: Record<ReportRelevance, string> = {
    muy_relevante: "Muy relevante",
    posible: "Posible",
    pendiente: "Pendiente de revisión",
    descartada: "Descartada",
};
const STATE_LABELS = { nueva: "Nueva", actualizada: "Actualizada", conocida: "" } as const;

const HEADERS = [
    "Estado",
    "Relevancia",
    "Expediente",
    "Objeto",
    "Institución",
    "Modalidad",
    "Etapa",
    "Fecha límite",
    "Documentos",
    "Motivos",
    "HonduCompras",
];
const COLUMN_WIDTHS = [12, 20, 24, 60, 40, 28, 24, 18, 36, 60, 16];

const honduras = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Tegucigalpa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
});

/** Excel dates have no time zone: the same wall-clock time as in Honduras, written as UTC. */
function hondurasWallClock(date: Date) {
    const parts = Object.fromEntries(honduras.formatToParts(date).map((part) => [part.type, part.value]));
    return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute)));
}

function sheetName(searchName: string, taken: Set<string>) {
    const base = searchName.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31).trim() || "Búsqueda";
    let name = base;
    for (let suffix = 2; taken.has(name.toLowerCase()); suffix++) {
        name = `${base.slice(0, 31 - ` (${suffix})`.length)} (${suffix})`;
    }
    taken.add(name.toLowerCase());
    return name;
}

function opportunityRow(opportunity: ReportOpportunity): Row {
    const text = (value: string | null): Cell => ({ value: value ?? "", type: String, wrap: true, alignVertical: "top" });
    return [
        text(opportunity.matchState ? STATE_LABELS[opportunity.matchState] : ""),
        text(RELEVANCE_LABELS[opportunity.relevance]),
        { value: opportunity.expediente, type: String, format: "@", alignVertical: "top" },
        text(formatOpportunityTitle(opportunity.title)),
        text(opportunity.buyerEntity),
        text(opportunity.modality),
        text(opportunity.stage),
        opportunity.closesAt
            ? { value: hondurasWallClock(opportunity.closesAt), type: Date, format: "dd/mm/yyyy hh:mm", alignVertical: "top" }
            : text("Sin fecha publicada"),
        text(opportunity.documents.length > 0 ? opportunity.documents.join("\n") : "Sin documentos"),
        text(opportunity.reasons.join("\n")),
        {
            value: `HYPERLINK("${opportunity.detailUrl.replaceAll('"', '""')}","Abrir")`,
            type: "Formula",
            textColor: "#2563eb",
            textDecoration: { underline: true },
            alignVertical: "top",
        },
    ];
}

/**
 * The report's Excel file (spec §7, plan D6): one sheet per search with its
 * opportunities, a bold header that stays in place, and a link to each
 * process in HonduCompras.
 */
export async function renderReportXlsx(sheets: XlsxSheet[]): Promise<Buffer> {
    const taken = new Set<string>();
    const header: Row = HEADERS.map((value) => ({ value, fontWeight: "bold", backgroundColor: "#f4f4f5" }));
    const workbook: Sheet<Buffer>[] = sheets.map((sheet) => ({
        sheet: sheetName(sheet.searchName, taken),
        data: [header, ...sheet.opportunities.map(opportunityRow)],
        columns: COLUMN_WIDTHS.map((width) => ({ width })),
        stickyRowsCount: 1,
    }));
    return writeXlsxFile(workbook).toBuffer();
}
