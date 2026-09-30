import { describe, expect, it } from "vitest";
import { fuseCandidates, type Candidate } from "./labeled-set";

const candidate = (processId: string, terms: string[], chunkIds: number[] = []): Candidate => ({
    process_id: processId,
    matched_terms: terms,
    matched_fields: ["title"],
    matched_unspsc: [],
    fragments: chunkIds.map((chunk_id) => ({ chunk_id })),
});

describe("fuseCandidates", () => {
    it("ranks processes found high by several lists first", () => {
        const fused = fuseCandidates([
            [candidate("a", []), candidate("b", []), candidate("c", [])],
            [candidate("b", []), candidate("c", [])],
        ]);

        expect(fused.map((item) => item.process_id)).toEqual(["b", "c", "a"]);
    });

    it("keeps every match of a process found by several lists, without repeats", () => {
        const [fused] = fuseCandidates([[candidate("a", ["laptop"], [1, 2])], [candidate("a", ["laptop", "servidor"], [2, 3])]]);

        expect(fused.matched_terms).toEqual(["laptop", "servidor"]);
        expect(fused.matched_fields).toEqual(["title"]);
        expect(fused.fragments).toEqual([{ chunk_id: 1 }, { chunk_id: 2 }, { chunk_id: 3 }]);
    });
});
