import { z } from "zod";

export const RelevanceSchema = z.enum(["muy_relevante", "posible", "descartada", "pendiente"]);
export type Relevance = z.infer<typeof RelevanceSchema>;

export const SearchRunStatusSchema = z.enum(["queued", "running", "completed", "partial", "failed"]);
export type SearchRunStatus = z.infer<typeof SearchRunStatusSchema>;

export const isRunActive = (status: SearchRunStatus) => status === "queued" || status === "running";
/** Completed or partial: a run whose results can be shown. */
export const isRunFinished = (status: SearchRunStatus) => status === "completed" || status === "partial";

/** Against the search's earlier finished runs (private.set_match_states); null on runs written before it existed. */
export const MatchStateSchema = z.enum(["nueva", "actualizada", "conocida"]);
export type MatchState = z.infer<typeof MatchStateSchema>;

export const searchRunSchema = z.object({
    id: z.uuid(),
    savedSearchId: z.uuid(),
    trigger: z.enum(["schedule", "manual"]),
    status: SearchRunStatusSchema,
    processesExamined: z.number().int().nullable(),
    candidates: z.number().int().nullable(),
    matchesCount: z.number().int().nullable(),
    newMatchesCount: z.number().int().nullable(),
    failedEvaluations: z.number().int(),
    sourceSyncedAt: z.string().nullable(),
    error: z.string().nullable(),
    createdAt: z.string(),
    completedAt: z.string().nullable(),
});
export type SearchRun = z.infer<typeof searchRunSchema>;

export const searchRunMatchSchema = z.object({
    processId: z.uuid(),
    retrievalRank: z.number().int(),
    relevance: RelevanceSchema,
    matchState: MatchStateSchema.nullable(),
    reasons: z.array(z.object({ text: z.string() })),
    expediente: z.string(),
    title: z.string(),
    buyerEntity: z.string(),
    modality: z.string().nullable(),
    stage: z.string().nullable(),
    closesAt: z.string().nullable(),
    detailUrl: z.string(),
    acquisitionType: z.string().nullable(),
    startsAt: z.string().nullable(),
    detectedAt: z.string().nullable(),
    documentsCount: z.number().int(),
});
export type SearchRunMatch = z.infer<typeof searchRunMatchSchema>;

export const requestSearchRunSchema = z.object({
    searchId: z.uuid(),
    orgSlug: z.string().min(1),
});
