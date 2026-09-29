import { z } from "zod";
import { evaluateMatch } from "../matching/evaluate";
import type { JobHandler } from "../queue";

const evaluateMatchMessageSchema = z.object({
    processId: z.uuid(),
    profile: z.object({
        description: z.string().min(1),
        offerings: z.array(z.string()),
        exclusions: z.array(z.string()),
    }),
    match: z.object({
        terms: z.array(z.string()),
        fields: z.array(z.string()),
        unspsc: z.array(z.string()),
    }),
    chunkIds: z.array(z.number().int()),
});

/**
 * Evaluates one retrieved candidate against a company profile with Jev.
 * The message carries the profile content and retrieval's evidence, so the
 * evaluation depends only on what it was asked, not on later edits.
 */
export const evaluateMatchJob: JobHandler = async (message, { pool }) => {
    await evaluateMatch(pool, evaluateMatchMessageSchema.parse(message));
};
