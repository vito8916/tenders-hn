// Matching profile extracted from a company's corporate purpose (objeto
// social). The legal text says everything a company may do; the profile
// splits it into lines of business with a proposed priority and the words a
// tender would use for each. UNSPSC classes come from HonduCompras's own
// product lines (see unspsc.ts); the model's codes are only hints, because
// codes recalled from memory are often wrong. The customer reviews and
// confirms it at onboarding; exclusions come from the customer, never from
// the legal text.
import { generateText, Output } from "ai";
import { z } from "zod";
import { modelForRole } from "@/lib/ai/models";

// Bump when the instructions or the schema change.
export const EXTRACTION_VERSION = "v2";

const lineOfBusinessSchema = z.object({
    name: z.string().describe("Nombre corto de la línea de negocio, como la reconocería un comprador (p. ej. «Licencias de software»)"),
    tier: z
        .enum(["primary", "secondary", "optional"])
        .describe("primary: finalidad principal; secondary: otras actividades que el texto enumera; optional: actividades de apoyo o mencionadas de paso"),
    description: z.string().describe("Una oración: qué bienes o servicios cubre, en términos de compras públicas"),
    keywords: z
        .array(z.string())
        .describe("5 a 15 nombres de los bienes o servicios como aparecen en títulos y líneas de producto de licitaciones hondureñas, con sinónimos y vocabulario local"),
    unspscHints: z
        .array(z.string().regex(/^\d{4}(\d{2})?$/))
        .describe("Familias (4 dígitos) o clases (6 dígitos) UNSPSC que probablemente lleven estos productos; solo como pista"),
    sourceExcerpt: z.string().describe("Frase copiada literalmente del objeto social de la que sale esta línea"),
});

export const extractedProfileSchema = z.object({
    summary: z.string().describe("Una o dos oraciones: a qué se dedica la empresa"),
    linesOfBusiness: z.array(lineOfBusinessSchema),
    ignoredClauses: z
        .array(z.string())
        .describe("Cláusulas genéricas que no se convirtieron en líneas de negocio, resumidas en pocas palabras"),
});

export type ExtractedProfile = z.infer<typeof extractedProfileSchema>;
export type LineOfBusiness = z.infer<typeof lineOfBusinessSchema>;

const INSTRUCTIONS = `Recibes el objeto social de una empresa hondureña, tal como aparece en su escritura de constitución. Conviértelo en el perfil que usará un sistema que busca oportunidades para esa empresa en las compras públicas de Honduras (HonduCompras).

Líneas de negocio:
- Cada línea es un tipo distinto de bien o servicio que una institución compraría en un mismo proceso. Ni tan amplia como «tecnología» ni tan estrecha como una marca o un modelo.
- Separa en líneas distintas lo que el texto enumera junto pero se compra por separado (por ejemplo, computadoras y cámaras de seguridad).
- No inventes actividades que el texto no menciona.

Prioridad (tier), como propuesta que la empresa confirmará:
- primary: lo que describe la finalidad principal.
- secondary: otras actividades que el texto enumera de forma concreta.
- optional: actividades de apoyo o mencionadas de paso (por ejemplo, vender materiales cuando la empresa es constructora).

Palabras clave: nombres de los bienes o servicios tal como aparecerían en el título o en las líneas de producto de un proceso, en el español de Honduras. Incluye sinónimos, abreviaturas y nombres comunes.
- Describen lo que se compra, nunca al comprador: no uses tipos de institución o lugar como «hospitales», «centros educativos» o «municipalidades».
- Cada una debe bastar para reconocer la línea: evita palabras genéricas o siglas amplias solas, como «servicios», «suministro», «equipo», «comunicaciones», «TIC» o «materiales de construcción».

Códigos UNSPSC (unspscHints): familias de 4 dígitos o clases de 6 que probablemente lleven estos productos. Son solo una pista; los códigos definitivos se toman del catálogo y de los procesos reales.

Ignora como líneas de negocio las cláusulas genéricas: capacidad de participar en licitaciones o contratar con el Estado, adquirir bienes inmuebles o abrir sucursales, cumplir requisitos regulatorios y «cualquier otra actividad de lícito comercio». Resúmelas en ignoredClauses.

sourceExcerpt debe ser una frase copiada literalmente del texto, sin cambios.`;

/** Proposes a matching profile from a corporate purpose; the customer reviews it before it is used. */
export async function extractProfile(corporatePurpose: string) {
    const model = modelForRole("extract");
    const startedAt = performance.now();
    const result = await generateText({
        model,
        instructions: INSTRUCTIONS,
        prompt: corporatePurpose,
        output: Output.object({ schema: extractedProfileSchema, name: "perfil_de_coincidencia" }),
    });

    return {
        profile: result.output,
        model: result.response.modelId,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        latencyMs: Math.round(performance.now() - startedAt),
    };
}

const normalize = (text: string) => text.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();

/** Lines whose sourceExcerpt is not in the corporate purpose: the model paraphrased or invented it. */
export function linesWithoutSource(profile: ExtractedProfile, corporatePurpose: string): LineOfBusiness[] {
    const text = normalize(corporatePurpose);
    return profile.linesOfBusiness.filter((line) => !text.includes(normalize(line.sourceExcerpt)));
}
