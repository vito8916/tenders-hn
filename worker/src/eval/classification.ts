// Scores a keep/drop decision over evaluated candidates against the labels.
import type { Label } from "./retrieval";

export interface JudgedCandidate {
    expediente: string;
    // Undefined when the process has no label (retrieval ranked it outside the labeled pool).
    label: Label | undefined;
    // Null when the evaluation failed or was skipped: such a candidate stays pending, never dropped.
    inScope: number | null;
    strength: number | null;
    insufficient: number | null;
}

export interface DecisionCounts {
    kept: number;
    relevantKept: number;
    relevantDropped: number;
    notRelevantKept: number;
    notRelevantDropped: number;
    unsureKept: number;
    unlabeledKept: number;
}

export function countDecisions(judged: JudgedCandidate[], keep: (candidate: JudgedCandidate) => boolean): DecisionCounts {
    const counts: DecisionCounts = {
        kept: 0,
        relevantKept: 0,
        relevantDropped: 0,
        notRelevantKept: 0,
        notRelevantDropped: 0,
        unsureKept: 0,
        unlabeledKept: 0,
    };

    for (const candidate of judged) {
        const kept = candidate.inScope === null || keep(candidate);
        if (kept) counts.kept++;
        if (candidate.label === "relevant") {
            counts[kept ? "relevantKept" : "relevantDropped"]++;
        } else if (candidate.label === "not_relevant") {
            counts[kept ? "notRelevantKept" : "notRelevantDropped"]++;
        } else if (kept) {
            counts[candidate.label === "unsure" ? "unsureKept" : "unlabeledKept"]++;
        }
    }

    return counts;
}
