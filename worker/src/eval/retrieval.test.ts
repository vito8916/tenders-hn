import { describe, expect, it } from "vitest";
import { scoreRetrieval, type LabeledProcess, type PoolItem } from "./retrieval";

const labels: LabeledProcess[] = [
    { processId: "a", expediente: "A", label: "relevant" },
    { processId: "b", expediente: "B", label: "not_relevant" },
    { processId: "c", expediente: "C", label: "unsure" },
    { processId: "d", expediente: "D", label: "relevant" },
    { processId: "s", expediente: "S", label: "relevant" },
];

const pool: PoolItem[] = [
    ...["a", "b", "c", "d"].map((processId, index) => ({
        processId,
        expediente: processId.toUpperCase(),
        stratum: "retrieved" as const,
        rank: index + 1,
        score: 0.1,
    })),
    { processId: "s", expediente: "S", stratum: "sampled", rank: null, score: null },
];

describe("scoreRetrieval", () => {
    it("reports recall, precision among judged labels, and unlabeled processes per cutoff", () => {
        const ranked = ["a", "x", "b", "c", "d", ...Array.from({ length: 20 }, (_, i) => `u${i}`), "s"];
        const score = scoreRetrieval({ ranked, labels, pool, sampleWeight: 7 });

        expect(score.cutoffs[0]).toEqual({ cutoff: 10, relevantFound: 2, recall: 2 / 3, precision: 2 / 3, unlabeled: 6 });
        expect(score.cutoffs[2]).toMatchObject({ cutoff: 50, relevantFound: 3, recall: 1 });
        expect(score.lastRelevantRank).toBe(26);
        expect(score.unlabeledAboveLastRelevant).toBe(21);
        expect(score.relevantRanks).toEqual([
            { expediente: "A", rank: 1 },
            { expediente: "D", rank: 5 },
            { expediente: "S", rank: 26 },
        ]);
        expect(score.estimatedMissesBeyondCutoffs).toBe(0);
    });

    it("counts relevant processes that are not returned and weights sampled misses", () => {
        const score = scoreRetrieval({ ranked: ["b", "a"], labels, pool, sampleWeight: 6.77 });

        expect(score.lastRelevantRank).toBeNull();
        expect(score.relevantNotReturned).toEqual(["D", "S"]);
        expect(score.unlabeledAboveLastRelevant).toBe(0);
        expect(score.estimatedMissesBeyondCutoffs).toBe(7);
    });
});
