import { describe, expect, it } from "vitest";
import { linesWithoutSource, type ExtractedProfile, type LineOfBusiness } from "./profile";

const line = (name: string, sourceExcerpt: string): LineOfBusiness => ({
    name,
    tier: "secondary",
    description: "",
    keywords: [],
    unspscHints: [],
    sourceExcerpt,
});

describe("linesWithoutSource", () => {
    const purpose = "Podrá comercializar  computadoras,\nservidores y dispositivos electrónicos; cámaras y controles de acceso.";

    it("accepts excerpts copied from the text, ignoring case and line breaks", () => {
        const profile: ExtractedProfile = {
            summary: "",
            ignoredClauses: [],
            linesOfBusiness: [line("Equipo de cómputo", "computadoras, servidores"), line("Seguridad", "Cámaras y controles de acceso")],
        };
        expect(linesWithoutSource(profile, purpose)).toEqual([]);
    });

    it("flags an excerpt the text does not contain", () => {
        const profile: ExtractedProfile = { summary: "", ignoredClauses: [], linesOfBusiness: [line("Licencias", "venta de licencias de software")] };
        expect(linesWithoutSource(profile, purpose).map((item) => item.name)).toEqual(["Licencias"]);
    });
});
