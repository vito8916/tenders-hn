// Relevance reasons (plan, Phase 3): short Spanish sentences built only from
// what retrieval matched, each tied to one source the UI can link to, so no
// reason claims more than the evidence shows (plan §3, principle 6).

export type ProcessField = "object" | "products" | "purchase_unit" | "buyer_entity";

/** A candidate as `public.retrieve_candidates` returns it (the columns reasons use). */
export interface RetrievedEvidence {
    field_terms: Partial<Record<ProcessField, string[]>>;
    matched_unspsc: string[];
    object_similarity: number | null;
    fragments: {
        document_id: string;
        document_version_id: string;
        document_title: string;
        page_start: number;
        page_end: number;
        matched_terms: string[];
        similarity: number | null;
    }[];
}

export type ReasonSource =
    | { kind: "field"; field: ProcessField }
    | { kind: "document"; documentId: string; documentVersionId: string; pageStart: number; pageEnd: number }
    | { kind: "unspsc"; codes: string[] }
    | { kind: "similarity" };

export interface Reason {
    text: string;
    source: ReasonSource;
}

const FIELD_NAMES: Record<ProcessField, string> = {
    object: "el objeto",
    products: "los productos",
    purchase_unit: "la unidad de compra",
    buyer_entity: "el nombre de la entidad",
};
const MAX_TERMS_PER_REASON = 3;
const MAX_DOCUMENT_REASONS = 3;

function spanishList(items: string[]) {
    return items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`;
}

function quotedTerms(terms: string[]) {
    const shown = terms.slice(0, MAX_TERMS_PER_REASON).map((term) => `"${term}"`);
    const hidden = terms.length - shown.length;
    return hidden > 0 ? `${shown.join(", ")} y ${hidden} más` : spanishList(shown);
}

const pages = (start: number, end: number) => (start === end ? `pág. ${start}` : `págs. ${start}–${end}`);

/**
 * @param matchedExclusions the company's exclusions the process object matches
 * (`public.match_exclusions`); they come first, since they decide the level.
 */
export function buildReasons(candidate: RetrievedEvidence, matchedExclusions: string[] = []): Reason[] {
    const reasons: Reason[] = [];

    if (matchedExclusions.length > 0) {
        reasons.push({
            text: `El objeto coincide con ${quotedTerms(matchedExclusions)}, que su empresa excluyó.`,
            source: { kind: "field", field: "object" },
        });
    }

    for (const field of Object.keys(FIELD_NAMES) as ProcessField[]) {
        const terms = candidate.field_terms[field];
        if (terms?.length) {
            reasons.push({ text: `Coincide con ${quotedTerms(terms)} en ${FIELD_NAMES[field]}.`, source: { kind: "field", field } });
        }
    }

    // Chunks overlap, so one page often yields several fragments: one reason per document and page range.
    const byPages = new Map<string, RetrievedEvidence["fragments"][number]>();
    for (const fragment of candidate.fragments) {
        if (fragment.matched_terms.length === 0) continue;
        const key = `${fragment.document_version_id}:${fragment.page_start}:${fragment.page_end}`;
        const seen = byPages.get(key);
        byPages.set(key, seen ? { ...seen, matched_terms: [...new Set([...seen.matched_terms, ...fragment.matched_terms])] } : fragment);
    }
    const termFragments = [...byPages.values()];
    // Without a term match, the passage retrieval found most similar still shows where to look.
    const documentFragments = termFragments.length > 0 ? termFragments.slice(0, MAX_DOCUMENT_REASONS) : candidate.fragments.slice(0, 1);
    for (const fragment of documentFragments) {
        const where = `${fragment.document_title}, ${pages(fragment.page_start, fragment.page_end)}`;
        const text =
            fragment.matched_terms.length > 0
                ? `Coincide con ${quotedTerms(fragment.matched_terms)} en ${where}.`
                : `Un pasaje de ${where} es similar a lo que ofrece su empresa.`;
        // Two documents with the same title can still produce the same sentence; it adds nothing twice.
        if (reasons.some((reason) => reason.text === text)) continue;
        reasons.push({
            text,
            source: {
                kind: "document",
                documentId: fragment.document_id,
                documentVersionId: fragment.document_version_id,
                pageStart: fragment.page_start,
                pageEnd: fragment.page_end,
            },
        });
    }

    const codes = candidate.matched_unspsc;
    if (codes.length > 0) {
        reasons.push({
            text:
                codes.length === 1
                    ? `Incluye un producto con el código UNSPSC ${codes[0]}.`
                    : `Incluye productos con los códigos UNSPSC ${spanishList(codes)}.`,
            source: { kind: "unspsc", codes },
        });
    }

    if (reasons.length === 0 && candidate.object_similarity !== null) {
        reasons.push({ text: "El objeto del proceso es similar a lo que ofrece su empresa.", source: { kind: "similarity" } });
    }

    return reasons;
}
