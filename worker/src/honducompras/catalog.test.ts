import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCatalogPage } from "./catalog";
import { ParserHealthError } from "./parse";

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

describe("parseCatalogPage", () => {
    it("reads the segments, leaving out the undefined one, and the form state", () => {
        const page = parseCatalogPage(fixture("catalog-default.html"));

        expect(page.segments).toHaveLength(56);
        expect(page.segments).toContainEqual({ value: "43", name: "Telecomunicaciones y radiodifusión de tecnología de la información" });
        expect(page.segments.map((segment) => segment.value)).not.toContain("00");
        expect(page.selected).toEqual({ segment: "98", family: "10", class: "15", commodity: "98101502" });
        expect(page.formFields.__VIEWSTATE).toBeTruthy();
    });

    it("reads a segment's families and the first family's classes after a segment postback", () => {
        const page = parseCatalogPage(fixture("catalog-segment-43.html"));

        expect(page.selected.segment).toBe("43");
        expect(page.families.map((family) => family.value)).toEqual(["19", "20", "21", "22", "23"]);
        expect(page.families).toContainEqual({ value: "23", name: "Software" });
        expect(page.classes[0]).toEqual({ value: "15", name: "Dispositivos de comunicación personal" });
    });

    it("reads a family's classes after a family postback", () => {
        const page = parseCatalogPage(fixture("catalog-family-4323.html"));

        expect(page.selected).toMatchObject({ segment: "43", family: "23" });
        expect(page.classes).toContainEqual({
            value: "16",
            name: "Software de planificación de recursos empresariales (ERP) y contabilidad financiera",
        });
    });

    it("fails the parser-health check when the dropdowns are gone", () => {
        expect(() => parseCatalogPage("<html><body><form></form></body></html>")).toThrow(ParserHealthError);
    });
});
