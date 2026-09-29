import { describe, expect, it } from "vitest";
import { countDecisions, type JudgedCandidate } from "./classification";

const candidate = (label: JudgedCandidate["label"], inScope: number | null): JudgedCandidate => ({
    expediente: `${label}-${inScope}`,
    label,
    inScope,
    strength: inScope === null ? null : inScope * 3,
    insufficient: 0.1,
});

describe("countDecisions", () => {
    it("counts kept and dropped candidates by label", () => {
        const judged = [
            candidate("relevant", 0.9),
            candidate("relevant", 0.2),
            candidate("not_relevant", 0.8),
            candidate("not_relevant", 0.1),
            candidate("unsure", 0.6),
            candidate(undefined, 0.7),
        ];

        expect(countDecisions(judged, (c) => (c.inScope ?? 0) >= 0.5)).toEqual({
            kept: 4,
            relevantKept: 1,
            relevantDropped: 1,
            notRelevantKept: 1,
            notRelevantDropped: 1,
            unsureKept: 1,
            unlabeledKept: 1,
        });
    });

    it("never drops a candidate whose evaluation failed", () => {
        const counts = countDecisions([candidate("relevant", null)], () => false);
        expect(counts).toMatchObject({ kept: 1, relevantKept: 1, relevantDropped: 0 });
    });
});
