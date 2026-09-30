import { z } from "zod";

// Must match saved_searches_schedule_check and private.search_schedule_hours.
export const SEARCH_SCHEDULES = ["manual", "daily", "twice_daily", "four_times_daily"] as const;
export type SearchSchedule = (typeof SEARCH_SCHEDULES)[number];

export const SCHEDULE_LABELS: Record<SearchSchedule, string> = {
    manual: "Solo cuando la ejecute",
    daily: "Una vez al día (7:00)",
    twice_daily: "Dos veces al día (7:00 y 13:00)",
    four_times_daily: "Cuatro veces al día (7:00, 10:00, 13:00 y 16:00)",
};

export const FILTER_KINDS = ["entity", "modality", "acquisition_type"] as const;
export type FilterKind = (typeof FILTER_KINDS)[number];
export type FilterOption = { value: string; openProcesses: number };
export type FilterOptions = Record<FilterKind, FilterOption[]>;

export const savedSearchSchema = z.object({
    id: z.uuid(),
    name: z.string(),
    inheritsProfile: z.boolean(),
    description: z.string().nullable(),
    keywords: z.array(z.string()),
    exclusions: z.array(z.string()),
    entities: z.array(z.string()),
    modalities: z.array(z.string()),
    acquisitionTypes: z.array(z.string()),
    schedule: z.enum(SEARCH_SCHEDULES),
    nextRunAt: z.string().nullable(),
    deliverByEmail: z.boolean(),
    emailWhenEmpty: z.boolean(),
    alertOnChanges: z.boolean(),
    isActive: z.boolean(),
});
export type SavedSearch = z.infer<typeof savedSearchSchema>;

export const searchLimitsSchema = z.object({
    hasActivePlan: z.boolean(),
    maxActiveSearches: z.number().int().nullable(),
    activeSearches: z.number().int(),
    allowedSchedules: z.array(z.enum(SEARCH_SCHEDULES)),
});
export type SearchLimits = z.infer<typeof searchLimitsSchema>;

const ITEM_MAX_CHARS = 200;
const LIST_MAX_ITEMS = 50;

// One item per line in the form; blank lines are dropped by the database trigger.
const itemListField = (label: string) =>
    z
        .array(z.string())
        .refine(
            (items) => items.every((item) => item.trim().length <= ITEM_MAX_CHARS),
            `Cada línea de ${label} puede tener hasta ${ITEM_MAX_CHARS} caracteres.`,
        )
        .refine((items) => items.filter((item) => item.trim()).length <= LIST_MAX_ITEMS, `Puede agregar hasta ${LIST_MAX_ITEMS} ${label}.`);

export const savedSearchInputSchema = z
    .object({
        name: z.string().trim().min(1, "Póngale un nombre a la búsqueda.").max(80, "El nombre puede tener hasta 80 caracteres."),
        inheritsProfile: z.boolean(),
        description: z.string().trim().max(8000, "La descripción puede tener hasta 8000 caracteres."),
        keywords: itemListField("términos"),
        exclusions: itemListField("exclusiones"),
        entities: z.array(z.string()),
        modalities: z.array(z.string()),
        acquisitionTypes: z.array(z.string()),
        schedule: z.enum(SEARCH_SCHEDULES),
        deliverByEmail: z.boolean(),
        emailWhenEmpty: z.boolean(),
        alertOnChanges: z.boolean(),
    })
    .refine((input) => input.inheritsProfile || input.description.length > 0, {
        path: ["description"],
        message: "Describa qué busca con esta búsqueda.",
    });
export type SavedSearchInput = z.infer<typeof savedSearchInputSchema>;

export const EMPTY_SAVED_SEARCH: SavedSearchInput = {
    name: "",
    inheritsProfile: true,
    description: "",
    keywords: [],
    exclusions: [],
    entities: [],
    modalities: [],
    acquisitionTypes: [],
    schedule: "daily",
    deliverByEmail: true,
    emailWhenEmpty: false,
    alertOnChanges: true,
};
