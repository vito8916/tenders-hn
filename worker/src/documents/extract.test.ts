import { describe, expect, it } from "vitest";
import { meanWordConfidence } from "./extract";

const header = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";

describe("meanWordConfidence", () => {
    it("averages the confidence of recognized words", () => {
        const tsv = [
            header,
            "1\t1\t0\t0\t0\t0\t0\t0\t2550\t3300\t-1\t",
            "5\t1\t1\t1\t1\t1\t100\t100\t80\t30\t96.5\tSoporte",
            "5\t1\t1\t1\t1\t2\t190\t100\t80\t30\t90\tfuncional",
            "5\t1\t1\t1\t1\t3\t280\t100\t40\t30\t81.25\tSAP",
        ].join("\n");
        expect(meanWordConfidence(tsv)).toBe(89.25);
    });

    it("ignores layout rows and empty words", () => {
        const tsv = [header, "4\t1\t1\t1\t1\t0\t0\t0\t10\t10\t-1\t", "5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t40\t "].join("\n");
        expect(meanWordConfidence(tsv)).toBeNull();
    });
});
