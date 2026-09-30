import { describe, expect, it } from "vitest";
import { fuseCandidates, type Candidate } from "./retrieve";

const fragment = (chunkId: number): Candidate["fragments"][number] => ({
    chunk_id: chunkId,
    document_id: "doc",
    document_version_id: "version",
    document_title: "Pliego",
    page_start: chunkId,
    page_end: chunkId,
    matched_terms: [],
    similarity: null,
});

const candidate = (
    processId: string,
    terms: string[],
    chunkIds: number[] = [],
    extra: Partial<Pick<Candidate, "field_terms" | "object_similarity">> = {},
): Candidate => ({
    process_id: processId,
    matched_terms: terms,
    matched_fields: ["object"],
    field_terms: {},
    matched_unspsc: [],
    object_similarity: null,
    fragments: chunkIds.map(fragment),
    ...extra,
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
        expect(fused.matched_fields).toEqual(["object"]);
        expect(fused.fragments.map((item) => item.chunk_id)).toEqual([1, 2, 3]);
    });

    it("merges the terms of each field and keeps the highest object similarity", () => {
        const [fused] = fuseCandidates([
            [candidate("a", ["laptop"], [], { field_terms: { object: ["laptop"] }, object_similarity: 0.4 })],
            [candidate("a", ["servidor"], [], { field_terms: { object: ["servidor"], products: ["servidor"] }, object_similarity: 0.6 })],
            [candidate("a", [], [])],
        ]);

        expect(fused.field_terms).toEqual({ object: ["laptop", "servidor"], products: ["servidor"] });
        expect(fused.object_similarity).toBe(0.6);
    });
});
