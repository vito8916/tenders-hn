import { z } from "zod";

export const RelevanceSchema = z.enum(["muy_relevante", "posible", "descartada", "pendiente"]);
export type Relevance = z.infer<typeof RelevanceSchema>;

export const SearchRunStatusSchema = z.enum(["queued", "running", "completed", "partial", "failed"]);
export type SearchRunStatus = z.infer<typeof SearchRunStatusSchema>;

export const searchRunSchema = z.object({
    id: z.uuid(),
    status: SearchRunStatusSchema,
    profileVersion: z.number().int(),
    candidates: z.number().int().nullable(),
    matchesCount: z.number().int().nullable(),
    failedEvaluations: z.number().int(),
    error: z.string().nullable(),
    createdAt: z.string(),
    completedAt: z.string().nullable(),
});
export type SearchRun = z.infer<typeof searchRunSchema>;

export const searchRunMatchSchema = z.object({
    processId: z.uuid(),
    retrievalRank: z.number().int(),
    relevance: RelevanceSchema,
    inScope: z.number().nullable(),
    reasons: z.array(z.object({ text: z.string() })),
    expediente: z.string(),
    title: z.string(),
    buyerEntity: z.string(),
    modality: z.string().nullable(),
    stage: z.string().nullable(),
    closesAt: z.string().nullable(),
    detailUrl: z.string(),
});
export type SearchRunMatch = z.infer<typeof searchRunMatchSchema>;

export const requestSearchRunSchema = z.object({
    orgId: z.uuid(),
    orgSlug: z.string().min(1),
});
