import type { UIMessage } from "ai";
import { z } from "zod";

/** What a conversation is about: one opportunity, or the relevant opportunities of one run (its report). */
export const chatContextSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("opportunity"),
        processId: z.uuid(),
        /** The run the panel was opened from: the answer notes where the process changed since. */
        runId: z.uuid().nullable(),
    }),
    z.object({ type: z.literal("report"), runId: z.uuid() }),
]);
export type ChatContext = z.infer<typeof chatContextSchema>;

export const chatContextTargetId = (context: ChatContext) => (context.type === "opportunity" ? context.processId : context.runId);

export const chatRequestSchema = z.object({
    context: chatContextSchema,
    message: z.object({
        id: z.string().min(1).max(100),
        text: z.string().trim().min(1, "Escriba una pregunta.").max(2000, "La pregunta no puede tener más de 2000 caracteres."),
    }),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** A source the server gave the model, without its text: what a validated citation points to. */
export const citationSchema = z.object({
    id: z.string(),
    kind: z.enum(["process", "document"]),
    processId: z.uuid(),
    expediente: z.string(),
    title: z.string(),
    url: z.string(),
    documentId: z.uuid().nullable(),
    documentVersionId: z.uuid().nullable(),
    pageStart: z.number().int().nullable(),
    pageEnd: z.number().int().nullable(),
});
export type Citation = z.infer<typeof citationSchema>;

export type ChatSource = Citation & { text: string };

/** Sent with each answer when it ends, and rebuilt from chat_messages on load. */
export type ChatMessageMetadata = {
    status?: "pending" | "completed" | "failed";
    citations?: Citation[];
    /** The answer cited an unknown source or none at all. */
    unverified?: boolean;
    creditsCharged?: number;
    creditsAvailable?: number;
};

export type ChatUIMessage = UIMessage<ChatMessageMetadata>;
