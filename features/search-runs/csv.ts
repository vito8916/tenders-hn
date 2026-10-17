import { MATCH_STATE_LABELS, RELEVANCE_LABELS } from "./results";
import type { SearchRunMatch } from "./schemas";

const HEADERS = [
    "Relevancia",
    "Novedad",
    "Expediente",
    "Objeto",
    "Institución",
    "Modalidad",
    "Etapa",
    "Tipo de adquisición",
    "Fecha de inicio",
    "Fecha límite",
    "Documentos",
    "Detectada",
    "Motivos",
    "Enlace en HonduCompras",
];

// yyyy-mm-dd hh:mm in Honduras time, which spreadsheets read as a date.
const dateFormat = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Tegucigalpa",
});
const formatDate = (value: string | null) => (value ? dateFormat.format(new Date(value)) : "");

const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** A run's matches as CSV (spec §12.2): tabular fields and the official link, with a BOM so spreadsheets read the accents. */
export function matchesToCsv(matches: SearchRunMatch[]) {
    const rows = matches.map((match) => [
        RELEVANCE_LABELS[match.relevance],
        match.matchState ? MATCH_STATE_LABELS[match.matchState] : "",
        match.expediente,
        match.title,
        match.buyerEntity,
        match.modality ?? "",
        match.stage ?? "",
        match.acquisitionType ?? "",
        formatDate(match.startsAt),
        formatDate(match.closesAt),
        match.documentsCount,
        formatDate(match.detectedAt),
        match.reasons.map((reason) => reason.text).join(" | "),
        match.detailUrl,
    ]);
    return `﻿${[HEADERS, ...rows].map((row) => row.map(escape).join(",")).join("\r\n")}\r\n`;
}
