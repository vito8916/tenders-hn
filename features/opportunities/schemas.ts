import { z } from "zod";

/**
 * The parts of a process version's detail (worker/src/honducompras/parse.ts,
 * ProcessDetail) that the detail panel shows. Lenient: older versions may
 * lack a field.
 */
export const processDetailSchema = z.object({
    object: z.string().nullish(),
    purchaseUnit: z.string().nullish(),
    startsAt: z.string().nullish(),
    bidsDueAt: z.string().nullish(),
    clarificationsDueAt: z.string().nullish(),
    fundingType: z.string().nullish(),
    fundingSource: z.string().nullish(),
    bidReceptionPlace: z.string().nullish(),
    bidDocumentPrice: z.object({ currency: z.string(), amount: z.string() }).nullish(),
    contact: z.object({ name: z.string().nullish(), phone: z.string().nullish(), email: z.string().nullish() }).nullish(),
    products: z
        .array(
            z.object({
                unspsc: z.string().nullish(),
                description: z.string().nullish(),
                specifications: z.string().nullish(),
                quantity: z.number().nullish(),
            }),
        )
        .nullish(),
});
export type ProcessDetail = z.infer<typeof processDetailSchema>;

export const PROCESS_EVENT_KINDS = ["created", "stage_changed", "deadline_changed", "document_added", "document_replaced", "document_removed"] as const;
export type ProcessEventKind = (typeof PROCESS_EVENT_KINDS)[number];

export const processEventSchema = z.object({
    id: z.number(),
    kind: z.enum(PROCESS_EVENT_KINDS),
    before: z.record(z.string(), z.unknown()).nullable(),
    after: z.record(z.string(), z.unknown()).nullable(),
    observedAt: z.string(),
});
export type ProcessEvent = z.infer<typeof processEventSchema>;

export const DOCUMENT_KIND_LABELS = { aviso: "Aviso", pliego: "Pliego", anexo: "Anexo", other: "Documento" } as const;

export const sourceDocumentSchema = z.object({
    id: z.uuid(),
    title: z.string(),
    kind: z.enum(["aviso", "pliego", "anexo", "other"]),
    sourceUrl: z.string(),
    firstSeenAt: z.string(),
});
export type SourceDocument = z.infer<typeof sourceDocumentSchema>;

/** The fixed statuses an organization gives an opportunity (spec 0.4 §5); no row means «Nueva». */
export const TrackingStatusSchema = z.enum(["en_evaluacion", "preparando_oferta", "presentada", "ganada", "perdida", "descartada"]);
export type TrackingStatus = z.infer<typeof TrackingStatusSchema>;

/** In the order the work goes; «nueva» is an opportunity nobody has acted on. */
export const STATUS_LABELS: Record<TrackingStatus | "nueva", string> = {
    nueva: "Nueva",
    en_evaluacion: "En evaluación",
    preparando_oferta: "Preparando oferta",
    presentada: "Presentada",
    ganada: "Ganada",
    perdida: "Perdida",
    descartada: "Descartada",
};

/** What the views and the table show of an opportunity's tracking. */
export type TrackedState = { status: TrackingStatus; assigneeId: string | null; assigneeName: string | null };

export const trackingSchema = z.object({
    status: TrackingStatusSchema,
    assignedTo: z.uuid().nullable(),
    discardReason: z.string().nullable(),
    updatedAt: z.string(),
    updatedByName: z.string().nullable(),
});
export type Tracking = z.infer<typeof trackingSchema>;

export const opportunityNoteSchema = z.object({
    id: z.uuid(),
    authorId: z.uuid().nullable(),
    authorName: z.string().nullable(),
    body: z.string(),
    createdAt: z.string(),
});
export type OpportunityNote = z.infer<typeof opportunityNoteSchema>;

/** A member the opportunity can be assigned to: anyone in the organization but viewers. */
export type Assignee = { userId: string; name: string };

const opportunityRef = { orgId: z.uuid(), orgSlug: z.string().min(1), processId: z.uuid() };

export const saveTrackingInputSchema = z.object({
    ...opportunityRef,
    /** null returns it to «Nueva». */
    status: TrackingStatusSchema.nullable(),
    assignedTo: z.uuid().nullable(),
    discardReason: z.string().trim().max(1000, "El motivo no puede tener más de 1000 caracteres").optional(),
});
export type SaveTrackingInput = z.infer<typeof saveTrackingInputSchema>;

export const addNoteInputSchema = z.object({
    ...opportunityRef,
    body: z.string().trim().min(1, "Escriba la nota.").max(2000, "La nota no puede tener más de 2000 caracteres"),
});
export type AddNoteInput = z.infer<typeof addNoteInputSchema>;

export const deleteNoteInputSchema = z.object({ orgId: z.uuid(), orgSlug: z.string().min(1), noteId: z.uuid() });
export type DeleteNoteInput = z.infer<typeof deleteNoteInputSchema>;
