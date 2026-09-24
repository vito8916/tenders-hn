import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    decodeProcessKey,
    parseDetailPage,
    ParserHealthError,
    parsePortalDateTime,
    parseSearchPage,
} from "./parse";

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

const page1 = parseSearchPage(fixture("search-2026-09-22_2026-09-23-page-1.html"));
const page2 = parseSearchPage(fixture("search-2026-09-22_2026-09-23-page-2.html"));

describe("parseSearchPage", () => {
    it("reads all 30 rows of a results page", () => {
        expect(page1.rows).toHaveLength(30);
        expect(page2.rows).toHaveLength(30);
    });

    it("parses the first row of the 22-23 Sep window", () => {
        expect(page1.rows[0]).toEqual({
            processKey: "117:1:LPN-008-2026",
            expediente: "LPN-008-2026",
            buyerEntity: "Instituto Hondureño de Seguridad Social (IHSS)",
            purchaseUnit: "Unidad Central",
            title: "“IHSS-GTIC-ADQUISICIÓN DE SOPORTE FUNCIONAL SAP PARA EL INSTITUTO HONDUREÑO DE SEGURIDAD SOCIAL (IHSS)”...",
            stage: "Recepción de Ofertas",
            modality: "Licitación pública nacional",
            startDate: "2026-09-22",
            closeDate: "2026-11-10",
            detailUrl:
                "http://sicc.honducompras.gob.hn/HC/Procesos/ProcesoHistorico.aspx?Id0=MQAAADEAAAA3AAAA-p2fyCf7jC3I%3d&Id1=MQAAAA%3d%3d-OFoziWLXW%2fg%3d&Id2=TAAAAFAAAABOAAAALQAAADAAAAAwAAAAOAAAAC0AAAAyAAAAMAAAADIAAAA2AAAA-SrWdjHKtOkg%3d",
        });
    });

    it("gives every row a unique process key across both pages", () => {
        const keys = [...page1.rows, ...page2.rows].map((row) => row.processKey);
        expect(new Set(keys).size).toBe(60);
    });

    it("reads the pager and the current page", () => {
        expect(page1.currentPage).toBe(1);
        expect(page2.currentPage).toBe(2);
        expect(page1.pageNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        expect(page2.pageNumbers).toEqual(page1.pageNumbers);
    });

    it("keeps the form state needed to post back the next page", () => {
        expect(page1.formFields.__VIEWSTATE.length).toBeGreaterThan(1000);
        expect(page1.formFields.__EVENTVALIDATION.length).toBeGreaterThan(100);
        expect(page1.formFields.__VIEWSTATE).not.toBe(page2.formFields.__VIEWSTATE);
    });

    it("returns no rows for the empty search form", () => {
        const form = parseSearchPage(fixture("search-form.html"));
        expect(form.rows).toEqual([]);
        expect(form.formFields.__VIEWSTATE).toBeTruthy();
    });

    it("returns no rows when the search has no matches", () => {
        const empty = parseSearchPage(fixture("search-2027-03-01-empty.html"));
        expect(empty.rows).toEqual([]);
        expect(empty.pageNumbers).toEqual([1]);
    });

    it("rejects a page without form state", () => {
        expect(() => parseSearchPage("<html><body>Service Unavailable</body></html>")).toThrow(ParserHealthError);
    });

    it("rejects a results grid whose columns changed", () => {
        const html = fixture("search-2026-09-22_2026-09-23-page-1.html").replace("Perido de Vigencia", "Vigencia");
        expect(() => parseSearchPage(html)).toThrow(/Unexpected result headers/);
    });
});

describe("parseDetailPage", () => {
    it("parses LPN-008-2026 (IHSS) with its three documents", () => {
        const detail = parseDetailPage(fixture("detail-LPN-008-2026.html"));

        expect(detail).toMatchObject({
            expediente: "LPN-008-2026",
            buyerEntity: "Instituto Hondureño de Seguridad Social (IHSS)",
            purchaseUnit: "Unidad Central",
            object: "“IHSS-GTIC-ADQUISICIÓN DE SOPORTE FUNCIONAL SAP PARA EL INSTITUTO HONDUREÑO DE SEGURIDAD SOCIAL (IHSS)”",
            startsAt: "2026-09-22T14:46:00-06:00",
            bidsDueAt: "2026-11-10T10:00:00-06:00",
            clarificationsDueAt: "2026-10-26T16:00:00-06:00",
            fundingType: "Recursos Nacionales",
            fundingSource: "Hispano-Hondureño",
            modality: "Licitación pública nacional",
            stage: "Recepción de Ofertas",
            acquisitionType: "Suministro de Bienes y/o Servicios",
            bidReceptionPlace: "SALON DE SESIONES DE INVALIDEZ, VEJEZ Y MUERTE IVM DEL IHSS",
            bidDocumentPrice: { currency: "Lps.", amount: "0.00" },
            contact: { name: "LIC. DELMI REYES", phone: "22226922", email: "delmi.reyes@ihss.hn" },
            products: [
                { unspsc: "43231505", description: "Software de gestión de recursos humanos", specifications: "Ver Pliego", quantity: 0 },
            ],
        });
        expect(detail.documents).toEqual([
            {
                title: "Aviso de Prensa",
                url: "http://h1.honducompras.gob.hn/Docs/Lic117LPN-008-2026100-AvisodePrensa.pdf",
                fileName: "Lic117LPN-008-2026100-AvisodePrensa.pdf",
                kind: "aviso",
            },
            {
                title: "Pliego o Terminos de Referencia",
                url: "http://h1.honducompras.gob.hn/Docs/Lic117LPN-008-2026201-PliegooTerminosdeReferencia.pdf",
                fileName: "Lic117LPN-008-2026201-PliegooTerminosdeReferencia.pdf",
                kind: "pliego",
            },
            {
                title: "Anexos al Pliego",
                url: "http://h1.honducompras.gob.hn/Docs/Lic117LPN-008-20261402-AnexosalPliego.pdf",
                fileName: "Lic117LPN-008-20261402-AnexosalPliego.pdf",
                kind: "anexo",
            },
        ]);
    });

    it("parses CM 39-019-2026 with no documents as a valid state", () => {
        const detail = parseDetailPage(fixture("detail-CM-39-019-2026.html"));

        expect(detail.expediente).toBe("CM 39-019-2026");
        expect(detail.documents).toEqual([]);
        expect(detail.fundingType).toBeNull();
        expect(detail.fundingSource).toBeNull();
        expect(detail.bidsDueAt).toBe("2026-09-30T14:00:00-06:00");
        expect(detail.products).toEqual([
            { unspsc: "41103913", description: "Accesorios para centrifugadoras de laboratorio", specifications: "Ninguna", quantity: 1 },
        ]);
    });

    it("rejects a page without the process table", () => {
        expect(() => parseDetailPage(fixture("search-form.html"))).toThrow(ParserHealthError);
    });

    it("rejects a page whose documents grid disappeared", () => {
        const html = fixture("detail-CM-39-019-2026.html").replaceAll("wdgDocumentos", "wdgArchivos");
        expect(() => parseDetailPage(html)).toThrow(/wdgDocumentos is missing/);
    });
});

describe("decodeProcessKey", () => {
    it("decodes the institution, the second id, and the expediente", () => {
        expect(decodeProcessKey(page1.rows[0].detailUrl)).toBe("117:1:LPN-008-2026");
    });
});

describe("parsePortalDateTime", () => {
    it("handles noon and midnight in 12-hour time", () => {
        expect(parsePortalDateTime("01/10/2026 12:30:00 p.m.")).toBe("2026-10-01T12:30:00-06:00");
        expect(parsePortalDateTime("01/10/2026 12:30:00 a.m.")).toBe("2026-10-01T00:30:00-06:00");
    });
});
