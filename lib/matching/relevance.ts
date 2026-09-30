// Relevance composition (plan, Phase 3): code decides the level from Jev's
// answers; the model never hides an opportunity by itself (spec §5).

export type Relevance = "muy_relevante" | "posible" | "descartada" | "pendiente";

// Provisional: read off labeled set v2 (four example profiles), where
// in_scope >= 0.8 kept 116 relevant of 117 and < 0.3 dropped no relevant one.
export const MUY_RELEVANTE_MIN_IN_SCOPE = 0.8;
export const DESCARTADA_MAX_IN_SCOPE = 0.3;

/**
 * @param inScope Jev's probability for `in_scope`, or null when the
 * evaluation failed after its retries.
 * @param excluded the process object matches one of the company's
 * exclusions: a verifiable exclusion prevails over Jev (spec §5), and the
 * process stays reviewable like any other descartada.
 */
export function composeRelevance(inScope: number | null, { excluded = false }: { excluded?: boolean } = {}): Relevance {
    if (excluded) {
        return "descartada";
    }
    if (inScope === null) {
        return "pendiente";
    }
    if (inScope >= MUY_RELEVANTE_MIN_IN_SCOPE) {
        return "muy_relevante";
    }
    return inScope < DESCARTADA_MAX_IN_SCOPE ? "descartada" : "posible";
}
