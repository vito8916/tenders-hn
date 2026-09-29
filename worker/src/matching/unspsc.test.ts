import { describe, expect, it } from "vitest";
import { lineQueryText, rankClasses, type TermHit } from "./unspsc";

const hit = (kind: TermHit["kind"], code: string, text: string, similarity: number): TermHit => ({ kind, code, text, similarity });

describe("rankClasses", () => {
    it("scores each class by its best hit and lists its nearest product descriptions", () => {
        const ranked = rankClasses([
            hit("product", "53102701", "Uniformes escolares", 0.71),
            hit("class", "531027", "Ropa › Uniformes", 0.74),
            hit("product", "53102702", "Uniformes empresariales", 0.69),
            hit("product", "53101602", "Camisas de hombre", 0.7),
        ]);

        expect(ranked).toEqual([
            { code: "531027", similarity: 0.74, examples: ["Uniformes escolares", "Uniformes empresariales"] },
            { code: "531016", similarity: 0.7, examples: ["Camisas de hombre"] },
        ]);
    });

    it("drops classes far below the best one", () => {
        const ranked = rankClasses([
            hit("product", "53141502", "Cierres de cremallera", 0.72),
            hit("product", "30171506", "Cierres o llavines para puertas", 0.58),
        ]);

        expect(ranked.map((item) => item.code)).toEqual(["531415"]);
    });

    it("returns nothing without hits", () => {
        expect(rankClasses([])).toEqual([]);
    });
});

describe("lineQueryText", () => {
    it("joins the line's name, description, and keywords", () => {
        expect(lineQueryText({ name: "Telas", description: "Venta de telas.", keywords: ["telas", "hilos"] })).toBe(
            "Telas. Venta de telas. Palabras clave: telas, hilos.",
        );
    });
});
