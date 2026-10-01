import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { processDetailSchema, sourceDocumentSchema } from "@/features/opportunities/schemas";
import { documentReadability, type ContextProcess, type Passage } from "./prompt";
import { citationSchema, type ChatContext, type Citation } from "./schemas";

export type StoredChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    status: "pending" | "completed" | "failed";
    citations: Citation[];
    unverified: boolean;
    creditsCharged: number | null;
};

const passageRowSchema = z.object({
    process_id: z.uuid(),
    document_id: z.uuid(),
    document_version_id: z.uuid(),
    document_title: z.string(),
    source_url: z.string(),
    page_start: z.number().int(),
    page_end: z.number().int(),
    content: z.string(),
});

// ========== QUERIES ==========

/** The processes with their latest detail and whether each published document could be read. */
export async function listContextProcesses(processIds: string[]): Promise<Omit<ContextProcess, "snapshot">[]> {
    const supabase = await createClient();
    const [{ data: processes, error }, { data: documents, error: documentsError }] = await Promise.all([
        supabase
            .from("procurement_processes")
            .select("id, expediente, title, buyer_entity, modality, stage, closes_at, detail_url, current_version_id")
            .in("id", processIds),
        supabase
            .from("source_documents")
            .select("id, process_id, title, kind, source_url, first_seen_at, current_version_id, download_error")
            .in("process_id", processIds)
            .is("removed_at", null)
            .order("first_seen_at"),
    ]);
    if (error) throw error;
    if (documentsError) throw documentsError;

    const [{ data: processVersions, error: processVersionsError }, { data: documentVersions, error: documentVersionsError }] = await Promise.all([
        supabase
            .from("process_versions")
            .select("id, detail")
            .in("id", processes.flatMap((process) => process.current_version_id ?? [])),
        supabase
            .from("document_versions")
            .select("id, extraction_status")
            .in("id", documents.flatMap((document) => document.current_version_id ?? [])),
    ]);
    if (processVersionsError) throw processVersionsError;
    if (documentVersionsError) throw documentVersionsError;
    const detailByVersion = new Map(processVersions.map((version) => [version.id, processDetailSchema.parse(version.detail)]));
    const statusByVersion = new Map(documentVersions.map((version) => [version.id, version.extraction_status]));

    const byId = new Map(processes.map((process) => [process.id, process]));
    return processIds.flatMap((processId) => {
        const process = byId.get(processId);
        if (!process) return [];
        return {
            processId,
            expediente: process.expediente,
            title: process.title,
            buyerEntity: process.buyer_entity,
            modality: process.modality,
            stage: process.stage,
            closesAt: process.closes_at,
            detailUrl: process.detail_url,
            detail: (process.current_version_id && detailByVersion.get(process.current_version_id)) || null,
            documents: documents
                .filter((document) => document.process_id === processId)
                .map((document) => ({
                    title: document.title,
                    kind: sourceDocumentSchema.shape.kind.parse(document.kind),
                    readability: documentReadability(
                        document.current_version_id ? (statusByVersion.get(document.current_version_id) ?? null) : null,
                        document.download_error,
                    ),
                })),
        };
    });
}

/** The document passages that best answer the question, among the processes' current documents. */
export async function retrievePassages(params: {
    processIds: string[];
    question: string;
    embedding: number[];
    embeddingModel: string;
    limit: number;
}): Promise<Passage[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("retrieve_chat_passages", {
        target_processes: params.processIds,
        query_text: params.question,
        query_embedding: JSON.stringify(params.embedding),
        target_model: params.embeddingModel,
        max_passages: params.limit,
    });
    if (error) throw error;
    return passageRowSchema.array().parse(data).map((row) => ({
        processId: row.process_id,
        documentId: row.document_id,
        documentVersionId: row.document_version_id,
        title: row.document_title,
        url: row.source_url,
        pageStart: row.page_start,
        pageEnd: row.page_end,
        content: row.content,
    }));
}

/** The user's conversation about the context, oldest first; RLS returns only the author's. */
export async function listThreadMessages(orgId: string, context: ChatContext): Promise<StoredChatMessage[]> {
    const supabase = await createClient();
    const thread = supabase.from("chat_threads").select("id").eq("org_id", orgId).eq("context_type", context.type);
    const { data: threadRow, error } = await (context.type === "opportunity"
        ? thread.eq("process_id", context.processId)
        : thread.eq("search_run_id", context.runId)
    ).maybeSingle();
    if (error) throw error;
    if (!threadRow) return [];

    const { data, error: messagesError } = await supabase
        .from("chat_messages")
        .select("id, role, content, status, citations, unverified, credits_charged")
        .eq("thread_id", threadRow.id)
        .order("created_at")
        .order("role", { ascending: false });
    if (messagesError) throw messagesError;

    return data.map((row) => ({
        id: row.id,
        role: row.role as StoredChatMessage["role"],
        content: row.content,
        status: row.status as StoredChatMessage["status"],
        citations: citationSchema.array().parse(row.citations),
        unverified: row.unverified,
        creditsCharged: row.credits_charged,
    }));
}

/** Credits left in the organization's current cycle; null without an active plan. */
export async function getCreditsAvailable(orgId: string): Promise<number | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_ai_credit_balance", { target_org: orgId });
    if (error) throw error;
    const [balance] = z.array(z.object({ available: z.number() })).max(1).parse(data);
    return balance?.available ?? null;
}

export async function getModelRate(model: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("ai_model_rates")
        .select("credits_per_1k_input, credits_per_1k_output")
        .eq("model", model)
        .eq("is_enabled", true)
        .maybeSingle();
    if (error) throw error;
    return data ? { input: Number(data.credits_per_1k_input), output: Number(data.credits_per_1k_output) } : null;
}

// ========== MUTATIONS ==========

/** Stores the question and reserves its credits (start_chat_turn). */
export async function startChatTurn(params: {
    orgId: string;
    context: ChatContext;
    question: string;
    clientMessageId: string;
    model: string;
    estimatedInputTokens: number;
    maxOutputTokens: number;
}) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .rpc("start_chat_turn", {
            target_org: params.orgId,
            target_context: params.context.type,
            target_id: params.context.type === "opportunity" ? params.context.processId : params.context.runId,
            question: params.question,
            client_message_id: params.clientMessageId,
            used_model: params.model,
            estimated_input_tokens: params.estimatedInputTokens,
            max_output_tokens: params.maxOutputTokens,
        });
    if (error) throw error;
    const [turn] = z.array(z.object({ thread_id: z.uuid(), user_message_id: z.uuid(), assistant_message_id: z.uuid() })).length(1).parse(data);
    return { threadId: turn.thread_id, userMessageId: turn.user_message_id, assistantMessageId: turn.assistant_message_id };
}

/** Stores the answer and charges its usage once (finish_chat_turn). */
export async function finishChatTurn(params: {
    assistantMessageId: string;
    content: string;
    citations: Citation[];
    unverified: boolean;
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    embeddingModel: string | null;
    embeddingTokens: number | null;
}) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .rpc("finish_chat_turn", {
            target_message: params.assistantMessageId,
            answer: params.content,
            answer_citations: params.citations,
            answer_unverified: params.unverified,
            response_model: params.model,
            used_input_tokens: params.inputTokens,
            used_output_tokens: params.outputTokens,
            used_latency_ms: params.latencyMs,
            query_embedding_model: params.embeddingModel ?? undefined,
            query_embedding_tokens: params.embeddingTokens ?? undefined,
        });
    if (error) throw error;
    const [settled] = z.array(z.object({ credits_charged: z.number(), credits_available: z.number() })).length(1).parse(data);
    return { creditsCharged: settled.credits_charged, creditsAvailable: settled.credits_available };
}

/** Gives the answer's credits back (fail_chat_turn). */
export async function failChatTurn(assistantMessageId: string, errorMessage: string) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("fail_chat_turn", { target_message: assistantMessageId, error_message: errorMessage });
    if (error) throw error;
}
