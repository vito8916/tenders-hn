import { z } from "zod";

// Must match company_profiles_locations_check.
export const HONDURAS_DEPARTMENTS = [
    "Atlántida",
    "Choluteca",
    "Colón",
    "Comayagua",
    "Copán",
    "Cortés",
    "El Paraíso",
    "Francisco Morazán",
    "Gracias a Dios",
    "Intibucá",
    "Islas de la Bahía",
    "La Paz",
    "Lempira",
    "Ocotepeque",
    "Olancho",
    "Santa Bárbara",
    "Valle",
    "Yoro",
] as const;

export const companyProfileSchema = z.object({
    description: z.string(),
    offerings: z.array(z.string()),
    exclusions: z.array(z.string()),
    locations: z.array(z.enum(HONDURAS_DEPARTMENTS)),
    version: z.number().int(),
    updatedAt: z.string(),
});
export type CompanyProfile = z.infer<typeof companyProfileSchema>;

const ITEM_MAX_CHARS = 200;
const LIST_MAX_ITEMS = 50;

// One item per line in the form; blank lines are allowed while typing and dropped by
// save_company_profile. Both checks are on the list, so the form shows them under the field.
const itemListField = (label: string) =>
    z
        .array(z.string())
        .refine(
            (items) => items.every((item) => item.trim().length <= ITEM_MAX_CHARS),
            `Cada línea de ${label} puede tener hasta ${ITEM_MAX_CHARS} caracteres.`,
        )
        .refine((items) => items.filter((item) => item.trim()).length <= LIST_MAX_ITEMS, `Puede agregar hasta ${LIST_MAX_ITEMS} ${label}.`);

export const companyProfileInputSchema = z.object({
    description: z
        .string()
        .trim()
        .min(1, "Describa qué vende la empresa.")
        .max(8000, "La descripción puede tener hasta 8000 caracteres."),
    offerings: itemListField("productos o servicios"),
    exclusions: itemListField("exclusiones"),
    locations: z.array(z.enum(HONDURAS_DEPARTMENTS)),
});
export type CompanyProfileInput = z.infer<typeof companyProfileInputSchema>;

export const EMPTY_COMPANY_PROFILE: CompanyProfileInput = { description: "", offerings: [], exclusions: [], locations: [] };

// «Mejorar con IA»: must match private.profile_improvements_left.
export const IMPROVEMENTS_PER_DAY = 3;
export const IMPROVABLE_FIELDS = ["description", "offerings", "exclusions"] as const;
export type ImprovableField = (typeof IMPROVABLE_FIELDS)[number];
export type ImprovementsRemaining = Record<ImprovableField, number>;

/** Whether a field has something to improve: offerings can also be drafted from the description. */
export function canImproveField(field: ImprovableField, profile: Pick<CompanyProfileInput, ImprovableField>) {
    const hasItems = (items: string[]) => items.some((item) => item.trim());
    if (field === "description") return profile.description.trim().length > 0;
    if (field === "offerings") return profile.description.trim().length > 0 || hasItems(profile.offerings);
    return hasItems(profile.exclusions);
}

export const improveProfileFieldInputSchema = z.object({
    field: z.enum(IMPROVABLE_FIELDS),
    // Null during onboarding, before the organization exists.
    orgId: z.uuid().nullable(),
    // The form as it is now; the description may still be empty.
    profile: companyProfileInputSchema.extend({ description: z.string().max(8000) }),
});
export type ImproveProfileFieldInput = z.infer<typeof improveProfileFieldInputSchema>;
