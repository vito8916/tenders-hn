import { describe, expect, it } from "vitest";
import { retryDelaySeconds } from "./queue";

describe("retryDelaySeconds", () => {
    it("doubles from 30 seconds", () => {
        expect([1, 2, 3, 4].map(retryDelaySeconds)).toEqual([30, 60, 120, 240]);
    });

    it("caps at 30 minutes", () => {
        expect(retryDelaySeconds(20)).toBe(30 * 60);
    });
});
