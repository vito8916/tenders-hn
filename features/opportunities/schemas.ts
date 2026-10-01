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

export const FeedbackDecisionSchema = z.enum(["interesa", "no_interesa"]);
export type FeedbackDecision = z.infer<typeof FeedbackDecisionSchema>;

export const feedbackSchema = z.object({
    decision: FeedbackDecisionSchema,
    reason: z.string().nullable(),
    decidedAt: z.string(),
    decidedByName: z.string().nullable(),
});
export type Feedback = z.infer<typeof feedbackSchema>;

export const saveFeedbackInputSchema = z.object({
    orgId: z.uuid(),
    orgSlug: z.string().min(1),
    processId: z.uuid(),
    /** null clears the decision. */
    decision: FeedbackDecisionSchema.nullable(),
    reason: z.string().trim().max(1000, "El motivo no puede tener más de 1000 caracteres").optional(),
});
export type SaveFeedbackInput = z.infer<typeof saveFeedbackInputSchema>;
