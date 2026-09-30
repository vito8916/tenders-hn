// Builds the `state` Jev evaluates: the company's offering, the process, what
// retrieval matched, and document fragments labeled by file and page. Jev's
// context is 32K tokens (plan §5.2), so products and fragments are added in
// order until the budget is spent and whatever is left out is recorded.
import type { JSONValue } from "ai";

type JsonObject = { [key: string]: JSONValue };

export interface MatchProfile {
    description: string;
    offerings: string[];
    exclusions: string[];
}

export interface ProcessForState {
    expediente: string;
    title: string;
    buyerEntity: string;
    purchaseUnit: string | null;
    modality: string | null;
    acquisitionType: string | null;
    stage: string | null;
    closesAt: string | null;
    products: { unspsc: string; description: string; specifications: string | null; quantity: number | null }[];
    documentCount: number;
}

export interface RetrievalMatch {
    terms: string[];
    fields: string[];
    unspsc: string[];
}

export interface Fragment {
    chunkId: number;
    documentTitle: string;
    pageStart: number;
    pageEnd: number;
    content: string;
}

export interface StateEvidence {
    fragmentIds: number[];
    fragmentsLeftOut: number;
    productsLeftOut: number;
    estimatedTokens: number;
}

// Jev's window is 32K tokens; the rest is left for its own prompt, the
// questions, and the error of estimating tokens from characters.
export const STATE_TOKEN_BUDGET = 24_000;
// Conservative for Spanish (accents and long words tokenize into more pieces than English).
const CHARS_PER_TOKEN = 3;
// One long technical specification must not crowd out the other products.
export const SPECIFICATION_CHARS = 600;

const estimateTokens = (value: unknown) => Math.ceil(JSON.stringify(value).length / CHARS_PER_TOKEN);

export function buildState({
    profile,
    process,
    match,
    fragments,
    budgetTokens = STATE_TOKEN_BUDGET,
}: {
    profile: MatchProfile;
    process: ProcessForState;
    match: RetrievalMatch;
    fragments: Fragment[];
    budgetTokens?: number;
}): { state: JsonObject; evidence: StateEvidence } {
    const productos: JsonObject[] = [];
    const fragmentos: JsonObject[] = [];
    const state: JsonObject = {
        empresa: {
            descripcion: profile.description,
            ofrece: profile.offerings,
            ...(profile.exclusions.length && { no_desea: profile.exclusions }),
        },
        proceso: {
            expediente: process.expediente,
            objeto: process.title,
            entidad: [process.buyerEntity, process.purchaseUnit].filter(Boolean).join(" · "),
            modalidad: process.modality,
            tipo_adquisicion: process.acquisitionType,
            etapa: process.stage,
            cierre: process.closesAt,
            productos,
            documentos: process.documentCount
                ? `${process.documentCount} documento(s); fragmentos abajo`
                : "El proceso no tiene documentos publicados",
        },
        coincidencias_de_busqueda: {
            terminos: match.terms,
            campos: match.fields,
            codigos_unspsc: match.unspsc,
        },
        fragmentos,
    };

    let tokens = estimateTokens(state);
    const fits = (item: unknown) => {
        const itemTokens = estimateTokens(item);
        if (tokens + itemTokens > budgetTokens) {
            return false;
        }
        tokens += itemTokens;
        return true;
    };

    let productsLeftOut = 0;
    for (const product of process.products) {
        const item: JsonObject = {
            descripcion: product.description,
            unspsc: product.unspsc,
            ...(product.quantity !== null && { cantidad: product.quantity }),
            ...(product.specifications && { especificaciones: product.specifications.slice(0, SPECIFICATION_CHARS) }),
        };
        if (fits(item)) {
            productos.push(item);
        } else {
            productsLeftOut++;
        }
    }

    const fragmentIds: number[] = [];
    for (const fragment of fragments) {
        const pages = fragment.pageStart === fragment.pageEnd ? `${fragment.pageStart}` : `${fragment.pageStart}-${fragment.pageEnd}`;
        const item = { archivo: fragment.documentTitle, paginas: pages, texto: fragment.content };
        if (fits(item)) {
            fragmentos.push(item);
            fragmentIds.push(fragment.chunkId);
        }
    }

    return {
        state,
        evidence: {
            fragmentIds,
            fragmentsLeftOut: fragments.length - fragmentIds.length,
            productsLeftOut,
            estimatedTokens: tokens,
        },
    };
}
