import { describe, expect, it } from "vitest";
import { formatOpportunityTitle } from "./title";

describe("formatOpportunityTitle", () => {
    it("strips wrapping quotes and converts capitals to sentence case, keeping acronyms and codes", () => {
        expect(formatOpportunityTitle("“IHSS-GTIC-ADQUISICIÓN DE SOPORTE FUNCIONAL SAP PARA EL INSTITUTO HONDUREÑO DE SEGURIDAD SOCIAL (IHSS)”")).toBe(
            "IHSS-GTIC-adquisición de soporte funcional SAP para el instituto hondureño de seguridad social (IHSS)"
        );
        expect(formatOpportunityTitle("CONSTRUCCIÓN PAVIMENTO DE CONCRETO HIDRÁULICO ALDEA LA CUESTA PR262026")).toBe(
            "Construcción pavimento de concreto hidráulico aldea la cuesta PR262026"
        );
    });

    it("keeps acronyms without vowels and known ones", () => {
        expect(formatOpportunityTitle("PAVIMENTACION CON CONCRETO 4000 PSI, KM 12, FASE III, FINANCIAMIENTO KFW Y BID")).toBe(
            "Pavimentacion con concreto 4000 PSI, KM 12, fase III, financiamiento KFW y BID"
        );
    });

    it("keeps tokens with digits", () => {
        expect(formatOpportunityTitle("LICITACION PUBLICA NACIONAL LPN-UAFCE-004-2026-SESAL ADQUISICION DE 12 KIT 4X100 ML")).toBe(
            "Licitacion publica nacional LPN-UAFCE-004-2026-SESAL adquisicion de 12 kit 4X100 ML"
        );
    });

    it("strips straight and angle quotes and a trailing period or comma", () => {
        expect(formatOpportunityTitle('"Servicios de consultoría"')).toBe("Servicios de consultoría");
        expect(formatOpportunityTitle("«Servicios de consultoría».")).toBe("Servicios de consultoría");
        expect(formatOpportunityTitle("“ADQUISICION DE EQUIPO”,")).toBe("Adquisicion de equipo");
    });

    it("leaves mixed-case titles as they are", () => {
        expect(formatOpportunityTitle("  Adquisición, Instalación y Configuración de un sistema de videovigilancia ")).toBe(
            "Adquisición, Instalación y Configuración de un sistema de videovigilancia"
        );
    });

    it("does not strip quotes that do not wrap the title", () => {
        expect(formatOpportunityTitle("“CONTRUCCION PAVIMENTO”. Ubicado en la Colonia Rotaria")).toBe("“CONTRUCCION PAVIMENTO”. Ubicado en la Colonia Rotaria");
    });
});
