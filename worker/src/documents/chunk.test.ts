import { describe, expect, it } from "vitest";
import { CHUNK_CHARS, chunkPages, OVERLAP_CHARS } from "./chunk";

const words = (count: number, word = "requisito") => Array.from({ length: count }, (_, i) => `${word}${i}`).join(" ");

describe("chunkPages", () => {
    it("merges short pages into one chunk with their page range", () => {
        const chunks = chunkPages([
            { pageNumber: 1, text: "DOCUMENTO DE CONTRATACIÓN" },
            { pageNumber: 2, text: "Instituto Hondureño de Seguridad Social" },
        ]);
        expect(chunks).toEqual([
            { ordinal: 0, pageStart: 1, pageEnd: 2, content: "DOCUMENTO DE CONTRATACIÓN\n\nInstituto Hondureño de Seguridad Social" },
        ]);
    });

    it("splits a long page into chunks that overlap", () => {
        const chunks = chunkPages([{ pageNumber: 7, text: words(1_000) }]);

        expect(chunks.length).toBeGreaterThan(1);
        for (const chunk of chunks) {
            expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_CHARS + OVERLAP_CHARS);
            expect([chunk.pageStart, chunk.pageEnd]).toEqual([7, 7]);
        }
        for (let i = 1; i < chunks.length; i++) {
            const previousEnd = chunks[i - 1].content.slice(-50);
            expect(chunks[i].content.slice(0, OVERLAP_CHARS + 50)).toContain(previousEnd);
        }
    });

    it("keeps every word of the document", () => {
        const pages = [1, 2, 3].map((pageNumber) => ({ pageNumber, text: words(400, `p${pageNumber}w`) }));
        const chunked = new Set(chunkPages(pages).flatMap((chunk) => chunk.content.split(/\s+/)));
        for (const page of pages) {
            for (const word of page.text.split(" ")) {
                expect(chunked).toContain(word);
            }
        }
    });

    it("skips blank pages and collapses layout whitespace", () => {
        const chunks = chunkPages([
            { pageNumber: 1, text: "   \n\n  " },
            { pageNumber: 2, text: "Plazo:      30 días\n\n\n\n\nGarantía:\t\t5%" },
        ]);
        expect(chunks).toEqual([{ ordinal: 0, pageStart: 2, pageEnd: 2, content: "Plazo: 30 días\n\nGarantía: 5%" }]);
    });

    it("never emits a chunk that is only the previous chunk's overlap", () => {
        const nearlyFull = "x".repeat(CHUNK_CHARS - OVERLAP_CHARS - 10);
        const chunks = chunkPages([
            { pageNumber: 1, text: `${words(20)}\n\n${nearlyFull}` },
            { pageNumber: 2, text: nearlyFull.replaceAll("x", "y") },
        ]);
        for (let i = 1; i < chunks.length; i++) {
            expect(chunks[i].content.length).toBeGreaterThan(OVERLAP_CHARS);
        }
        expect(chunks[chunks.length - 1].content).toContain("yyy");
    });

    it("returns no chunks for a document without text", () => {
        expect(chunkPages([{ pageNumber: 1, text: "" }])).toEqual([]);
    });
});
