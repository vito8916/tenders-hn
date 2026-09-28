import { describe, expect, it } from "vitest";
import { modelForRole } from "./models";

describe("modelForRole", () => {
    it("returns the role default", () => {
        expect(modelForRole("evaluate", {})).toBe("typesafe-ai/jev");
    });

    it("lets AI_MODEL_<ROLE> override the default", () => {
        expect(modelForRole("chat", { AI_MODEL_CHAT: "openai/gpt-6-luna" })).toBe("openai/gpt-6-luna");
    });

    it("ignores a blank override", () => {
        expect(modelForRole("evaluate", { AI_MODEL_EVALUATE: "  " })).toBe("typesafe-ai/jev");
    });

    it("enables a role that has no default through its override", () => {
        expect(modelForRole("rerank", { AI_MODEL_RERANK: "cohere/rerank-v3.5" })).toBe("cohere/rerank-v3.5");
    });

    it("throws for a role with no model", () => {
        expect(() => modelForRole("rerank", {})).toThrow(/AI_MODEL_RERANK/);
    });
});
