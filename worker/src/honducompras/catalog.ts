import { parse, type HTMLElement } from "node-html-parser";
import { hiddenFields, ParserHealthError } from "./parse";

// CUBS (Catálogo Único de Bienes y Servicios): ONCAE's adaptation of UNSPSC,
// the codes HonduCompras product lines carry. It has no download; each
// dropdown posts back and the page returns the next level's options. Family
// and class values are two digits relative to their parent.
export const CATALOG_URL = "http://h1.honducompras.gob.hn/CUBS/Default.aspx";

const FIELD = "ctl00$cphCuerpo$WebTab1$tmpl1$";
export const CATALOG_FIELDS = {
    segment: `${FIELD}ddlSegment`,
    family: `${FIELD}ddlFamily`,
    class: `${FIELD}ddlClass`,
    commodity: `${FIELD}ddlCommodity`,
} as const;

// "(No Definido)": not a category.
const UNDEFINED_SEGMENT = "00";

export interface CatalogOption {
    value: string;
    name: string;
}

export interface CatalogPage {
    formFields: Record<string, string>;
    // The current value of every dropdown, which a postback must send back.
    selected: Record<keyof typeof CATALOG_FIELDS, string>;
    segments: CatalogOption[];
    families: CatalogOption[];
    classes: CatalogOption[];
}

function dropdown(root: HTMLElement, name: string): { options: CatalogOption[]; selected: string } {
    const select = root.querySelector(`select[name="${name}"]`);
    if (!select) {
        throw new ParserHealthError(`Catalog dropdown ${name} is missing`);
    }
    const options = select.querySelectorAll("option").map((option) => ({
        value: option.getAttribute("value") ?? "",
        name: option.text.replace(/\s+/g, " ").trim(),
        selected: option.hasAttribute("selected"),
    }));
    return {
        options: options.filter((option) => option.value).map(({ value, name }) => ({ value, name })),
        selected: options.find((option) => option.selected)?.value ?? options[0]?.value ?? "",
    };
}

export function parseCatalogPage(html: string): CatalogPage {
    const root = parse(html);
    const segment = dropdown(root, CATALOG_FIELDS.segment);
    const family = dropdown(root, CATALOG_FIELDS.family);
    const classDropdown = dropdown(root, CATALOG_FIELDS.class);
    const commodity = dropdown(root, CATALOG_FIELDS.commodity);

    const segments = segment.options.filter((option) => option.value !== UNDEFINED_SEGMENT);
    if (segments.length < 40 || segments.some((option) => !/^\d{2}$/.test(option.value))) {
        throw new ParserHealthError(`Unexpected catalog segments (${segments.length})`);
    }
    for (const option of [...family.options, ...classDropdown.options]) {
        if (!/^\d{2}$/.test(option.value)) {
            throw new ParserHealthError(`Unexpected catalog option value "${option.value}"`);
        }
    }

    return {
        formFields: hiddenFields(root),
        selected: { segment: segment.selected, family: family.selected, class: classDropdown.selected, commodity: commodity.selected },
        segments,
        families: family.options,
        classes: classDropdown.options,
    };
}
