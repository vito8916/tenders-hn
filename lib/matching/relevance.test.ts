import { describe, expect, it } from "vitest";
import { composeRelevance } from "./relevance";

describe("composeRelevance", () => {
    it("marks a failed evaluation as pending", () => {
        expect(composeRelevance(null)).toBe("pendiente");
    });

    it("uses the in_scope thresholds, inclusive at 0.8 and exclusive at 0.3", () => {
        expect(composeRelevance(0.95)).toBe("muy_relevante");
        expect(composeRelevance(0.8)).toBe("muy_relevante");
        expect(composeRelevance(0.79)).toBe("posible");
        expect(composeRelevance(0.3)).toBe("posible");
        expect(composeRelevance(0.29)).toBe("descartada");
        expect(composeRelevance(0)).toBe("descartada");
    });
});
