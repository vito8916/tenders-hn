// Scores a ranked candidate list against the labeled set (labeled-set/*.json).
// Kept free of I/O so it can be tested and reused by the other comparison arms.

export type Label = "relevant" | "not_relevant" | "unsure";

export interface LabeledProcess {
    processId: string;
    expediente: string;
    label: Label;
    note?: string;
}

export interface PoolItem {
    processId: string;
    expediente: string;
    stratum: "retrieved" | "sampled";
    rank: number | null;
    score: number | null;
}

export const CUTOFFS = [10, 25, 50, 100, 150] as const;

export interface CutoffScore {
    cutoff: number;
    relevantFound: number;
    recall: number;
    // Among labeled processes in the top `cutoff`, ignoring unsure and unlabeled ones.
    precision: number | null;
    unlabeled: number;
}

export interface RetrievalScore {
    returned: number;
    relevant: number;
    unsure: number;
    cutoffs: CutoffScore[];
    // The depth a cutoff must reach to keep every known relevant process; null if one was not returned.
    lastRelevantRank: number | null;
    relevantNotReturned: string[];
    // Processes ranked above the last relevant one that have no label: the labels
    // cannot say whether they are relevant, so a large number means the ranking
    // has moved away from the labeled pool.
    unlabeledAboveLastRelevant: number;
    // Relevant processes from the random sample of the not-retrieved stratum that
    // fall outside the deepest cutoff, each standing for `sampleWeight` processes.
    estimatedMissesBeyondCutoffs: number;
    relevantRanks: { expediente: string; rank: number | null }[];
}

export function scoreRetrieval({
    ranked,
    labels,
    pool,
    sampleWeight,
}: {
    ranked: string[];
    labels: LabeledProcess[];
    pool: PoolItem[];
    sampleWeight: number;
}): RetrievalScore {
    const labelById = new Map(labels.map((item) => [item.processId, item.label]));
    const rankById = new Map(ranked.map((processId, index) => [processId, index + 1]));
    const relevant = labels.filter((item) => item.label === "relevant");
    const relevantRanks = relevant
        .map((item) => ({ expediente: item.expediente, rank: rankById.get(item.processId) ?? null }))
        .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

    const cutoffs = CUTOFFS.map((cutoff) => {
        const top = ranked.slice(0, cutoff).map((processId) => labelById.get(processId));
        const relevantFound = top.filter((label) => label === "relevant").length;
        const judged = top.filter((label) => label === "relevant" || label === "not_relevant").length;
        return {
            cutoff,
            relevantFound,
            recall: relevant.length ? relevantFound / relevant.length : 1,
            precision: judged ? relevantFound / judged : null,
            unlabeled: top.filter((label) => label === undefined).length,
        };
    });

    const relevantNotReturned = relevantRanks.filter((item) => item.rank === null).map((item) => item.expediente);
    const lastRelevantRank = relevantNotReturned.length ? null : Math.max(0, ...relevantRanks.map((item) => item.rank ?? 0));
    const depth = lastRelevantRank ?? ranked.length;
    const deepestCutoff = CUTOFFS[CUTOFFS.length - 1];
    const sampledIds = new Set(pool.filter((item) => item.stratum === "sampled").map((item) => item.processId));
    const sampledMisses = relevant.filter(
        (item) => sampledIds.has(item.processId) && (rankById.get(item.processId) ?? Infinity) > deepestCutoff,
    ).length;

    return {
        returned: ranked.length,
        relevant: relevant.length,
        unsure: labels.filter((item) => item.label === "unsure").length,
        cutoffs,
        lastRelevantRank,
        relevantNotReturned,
        unlabeledAboveLastRelevant: ranked.slice(0, depth).filter((processId) => !labelById.has(processId)).length,
        estimatedMissesBeyondCutoffs: Math.round(sampledMisses * sampleWeight),
        relevantRanks,
    };
}
