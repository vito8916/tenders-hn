import { parse, type HTMLElement } from "node-html-parser";

export const SOURCE = "honducompras_v1";
export const SEARCH_URL = "http://sicc.honducompras.gob.hn/HC/Procesos/BusquedaHistorico.aspx";

/** The page no longer looks like what the parser was written for. Never store its data. */
export class ParserHealthError extends Error {
    name = "ParserHealthError";
}

export interface ListingRow {
    processKey: string;
    expediente: string;
    buyerEntity: string;
    purchaseUnit: string | null;
    /** Truncated by the portal; the detail page has the full object. */
    title: string;
    stage: string | null;
    modality: string | null;
    /** yyyy-mm-dd */
    startDate: string;
    /** yyyy-mm-dd */
    closeDate: string | null;
    detailUrl: string;
}

export interface SearchPage {
    /** Hidden fields to post back for the next page. */
    formFields: Record<string, string>;
    rows: ListingRow[];
    currentPage: number;
    /** Every page number the pager links to or shows as current. */
    pageNumbers: number[];
}

export interface ProcessDetail {
    expediente: string;
    buyerEntity: string;
    purchaseUnit: string | null;
    object: string;
    /** ISO timestamps with the Honduras offset (-06:00). */
    startsAt: string | null;
    bidsDueAt: string | null;
    clarificationsDueAt: string | null;
    fundingType: string | null;
    fundingSource: string | null;
    modality: string | null;
    stage: string | null;
    acquisitionType: string | null;
    bidReceptionPlace: string | null;
    bidDocumentPrice: { currency: string; amount: string } | null;
    contact: { name: string | null; phone: string | null; email: string | null };
    products: { unspsc: string; description: string; specifications: string | null; quantity: number | null }[];
    documents: { title: string; url: string; fileName: string; kind: DocumentKind }[];
}

export type DocumentKind = "aviso" | "pliego" | "anexo" | "other";

const RESULTS_GRID_ID = "ctl00_cphCuerpo_gvResultados";
const EXPECTED_RESULT_HEADERS = ["Proceso de Adquisición", "Etapa", "Modalidad", "Perido de Vigencia"];
const NO_RESULTS_TEXT = "No Se Encontro Infomación";
const EMPTY_VALUES = new Set(["", "(No Definida)", "(Todas)"]);

function clean(text: string | undefined): string | null {
    const value = (text ?? "").replace(/\s+/g, " ").trim();
    return EMPTY_VALUES.has(value) ? null : value;
}

function required(value: string | null, what: string): string {
    if (!value) {
        throw new ParserHealthError(`Missing ${what}`);
    }
    return value;
}

/** dd/mm/yyyy → yyyy-mm-dd */
export function parsePortalDate(text: string): string {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
    if (!match) {
        throw new ParserHealthError(`Unexpected date "${text}"`);
    }
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
}

/** "22/09/2026 02:46:00 p.m." → "2026-09-22T14:46:00-06:00" (Honduras has no daylight saving time). */
export function parsePortalDateTime(text: string): string {
    const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2}) ([ap])\.m\.$/.exec(text.trim());
    if (!match) {
        throw new ParserHealthError(`Unexpected date and time "${text}"`);
    }
    const [, day, month, year, hour12, minute, second, meridiem] = match;
    const hour = (Number(hour12) % 12) + (meridiem === "p" ? 12 : 0);
    return `${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${minute}:${second}-06:00`;
}

/**
 * Detail links carry Id0 (institution code), Id1 and Id2 (expediente), each
 * base64 of UTF-32LE text followed by "-<signature>". The decoded triple is
 * the stable process key; the expediente alone is not unique.
 */
export function decodeProcessKey(detailUrl: string): string {
    const params = new URL(detailUrl).searchParams;
    const parts = ["Id0", "Id1", "Id2"].map((name) => {
        const encoded = params.get(name)?.split("-")[0];
        if (!encoded) {
            throw new ParserHealthError(`Detail link without ${name}`);
        }
        const bytes = Buffer.from(encoded, "base64");
        const codePoints = Array.from({ length: bytes.length / 4 }, (_, i) => bytes.readUInt32LE(i * 4));
        return String.fromCodePoint(...codePoints);
    });
    return parts.join(":");
}

function hiddenFields(root: HTMLElement): Record<string, string> {
    const fields: Record<string, string> = {};
    for (const input of root.querySelectorAll('input[type="hidden"]')) {
        const name = input.getAttribute("name");
        if (name) {
            fields[name] = input.getAttribute("value") ?? "";
        }
    }
    if (!fields.__VIEWSTATE || !fields.__EVENTVALIDATION) {
        throw new ParserHealthError("Form state fields are missing");
    }
    return fields;
}

function parseListingRow(row: HTMLElement): ListingRow {
    const cells = row.querySelectorAll(":scope > td");
    const span = (label: string) => row.querySelector(`span[id$="_${label}"]`)?.text;
    const link = row.querySelector('a[id$="_hlGoTo"]')?.getAttribute("href");

    if (cells.length !== 5 || !link) {
        throw new ParserHealthError("Unexpected result row layout");
    }

    const detailUrl = new URL(link, SEARCH_URL).toString();
    const closeDate = clean(span("Label4"));

    return {
        processKey: decodeProcessKey(detailUrl),
        expediente: required(clean(span("Label6")), "expediente"),
        buyerEntity: required(clean(span("Label1")), "entity"),
        purchaseUnit: clean(span("Label2")),
        title: required(clean(span("Label5")), "object"),
        stage: clean(cells[1].text),
        modality: clean(cells[2].text),
        startDate: parsePortalDate(required(clean(span("Label3")), "start date")),
        closeDate: closeDate ? parsePortalDate(closeDate) : null,
        detailUrl,
    };
}

/** Parses a search results page (the first result page or any Page$N postback). */
export function parseSearchPage(html: string): SearchPage {
    const root = parse(html);
    const formFields = hiddenFields(root);
    const grid = root.getElementById(RESULTS_GRID_ID);

    // The search form has no grid; a search without matches has a grid with a single message cell.
    if (!grid || (grid.querySelectorAll("th").length === 0 && clean(grid.querySelector("td")?.text) === NO_RESULTS_TEXT)) {
        return { formFields, rows: [], currentPage: 1, pageNumbers: [1] };
    }

    const headers = grid.querySelectorAll("th").map((th) => clean(th.text));
    if (EXPECTED_RESULT_HEADERS.some((header, index) => headers[index] !== header)) {
        throw new ParserHealthError(`Unexpected result headers: ${headers.join(" | ")}`);
    }

    const rows = grid
        .querySelectorAll(":scope > tr, :scope > tbody > tr")
        .filter((row) => row.querySelector('a[id$="_hlGoTo"]'))
        .map(parseListingRow);

    // Pager: links post back "Page$N"; the current page is a plain <span>.
    const pagerCells = grid.querySelectorAll("td[colspan] table td");
    const pageNumbers = new Set<number>();
    let currentPage = 1;
    for (const cell of pagerCells) {
        const target = /Page\$(\d+)/.exec(cell.querySelector("a")?.getAttribute("href") ?? "");
        if (target) {
            pageNumbers.add(Number(target[1]));
        } else if (/^\d+$/.test(cell.text.trim())) {
            currentPage = Number(cell.text.trim());
            pageNumbers.add(currentPage);
        }
    }
    pageNumbers.add(currentPage);

    return { formFields, rows, currentPage, pageNumbers: [...pageNumbers].sort((a, b) => a - b) };
}

function documentKind(title: string): DocumentKind {
    const normalized = title.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    if (normalized.includes("anexo")) return "anexo";
    if (normalized.includes("aviso")) return "aviso";
    if (normalized.includes("pliego") || normalized.includes("terminos de referencia")) return "pliego";
    return "other";
}

/** Rows of an Infragistics grid (products or documents tab); empty when the process has none. */
function gridRows(root: HTMLElement, gridId: string): HTMLElement[] {
    const grid = root.getElementById(gridId);
    if (!grid) {
        throw new ParserHealthError(`Grid ${gridId} is missing`);
    }
    return grid.querySelectorAll('tbody[id*="mkr:rows"] > tr');
}

export function parseDetailPage(html: string): ProcessDetail {
    const root = parse(html);
    const table = root.getElementById("ctl00_cphCuerpo_dvProceso");
    if (!table) {
        throw new ParserHealthError("Process table is missing");
    }

    const fields = new Map<string, HTMLElement>();
    for (const row of table.querySelectorAll("tr")) {
        const [label, value] = row.querySelectorAll("td");
        if (label && value) {
            fields.set(clean(label.text) ?? "", value);
        }
    }

    const text = (label: string) => clean(fields.get(label)?.text);
    const dateTime = (label: string) => {
        const value = text(label);
        return value ? parsePortalDateTime(value) : null;
    };
    const byId = (id: string) => clean(root.getElementById(id)?.text);

    const priceCurrency = byId("ctl00_cphCuerpo_dvProceso_Label3");
    const priceAmount = byId("ctl00_cphCuerpo_dvProceso_Label1");

    const products = gridRows(root, "ctl00_cphCuerpo_WebTab1_tmpl0_wdgProductos").map((row) => {
        const [unspsc, description, specifications, quantity] = row.querySelectorAll("td").map((cell) => clean(cell.text));
        return {
            unspsc: required(unspsc, "UNSPSC code"),
            description: required(description, "product description"),
            specifications,
            quantity: quantity === null ? null : Number(quantity.replace(/,/g, "")),
        };
    });

    const documents = gridRows(root, "ctl00_cphCuerpo_WebTab1_tmpl1_wdgDocumentos").map((row) => {
        const title = required(clean(row.querySelector("td")?.text), "document title");
        const link = row.querySelector("a[href]");
        const url = required(clean(link?.getAttribute("href")), "document link");
        return { title, url: new URL(url, SEARCH_URL).toString(), fileName: required(clean(link?.text), "file name"), kind: documentKind(title) };
    });

    return {
        expediente: required(text("Expediente"), "expediente"),
        buyerEntity: required(text("Entidad"), "entity"),
        purchaseUnit: text("Unidad de Compra"),
        object: required(text("Objeto"), "object"),
        startsAt: dateTime("Fecha de Inicio"),
        bidsDueAt: dateTime("Fecha Recepción Ofertas"),
        clarificationsDueAt: dateTime("Fecha Cierre Aclaratorias"),
        fundingType: text("Tipo Fuente"),
        fundingSource: text("Fuente"),
        modality: required(text("Modalidad"), "modality"),
        stage: required(text("Etapa"), "stage"),
        acquisitionType: text("Tipo Adquisición"),
        bidReceptionPlace: text("Lugar Recepción Ofertas"),
        bidDocumentPrice: priceCurrency && priceAmount ? { currency: priceCurrency, amount: priceAmount } : null,
        contact: {
            name: byId("ctl00_cphCuerpo_dvProceso_Label2"),
            phone: byId("ctl00_cphCuerpo_dvProceso_Label4"),
            email: byId("ctl00_cphCuerpo_dvProceso_HyperLink1"),
        },
        products,
        documents,
    };
}
