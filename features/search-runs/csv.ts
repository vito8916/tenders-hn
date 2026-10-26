import { STATUS_LABELS } from "@/features/opportunities/schemas";
import type { Opportunity } from "./opportunities";
import { MATCH_STATE_LABELS, RELEVANCE_LABELS } from "./results";

const HEADERS = [
    "Relevancia",
    "Novedad",
    "Seguimiento",
    "Responsable",
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

/** A view's opportunities as CSV (spec §12.2): tabular fields, the team's tracking, and the official link, with a BOM so spreadsheets read the accents. */
export function matchesToCsv(matches: Opportunity[]) {
    const rows = matches.map((match) => [
        RELEVANCE_LABELS[match.relevance],
        match.matchState ? MATCH_STATE_LABELS[match.matchState] : "",
        STATUS_LABELS[match.tracking?.status ?? "nueva"],
        match.tracking?.assigneeName ?? "",
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
