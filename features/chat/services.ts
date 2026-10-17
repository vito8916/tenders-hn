import "server-only";
import { embed } from "ai";
import { EMBEDDING_DIMENSIONS, modelForRole } from "@/lib/ai/models";
import { getUserOrgRole } from "@/features/memberships/repository";
import { getOrgRun, listSearchRunMatches } from "@/features/search-runs/repository";
import type { SearchRunMatch } from "@/features/search-runs/schemas";
import { UserFacingError } from "@/lib/errors";
import { validateCitations } from "./citations";
import { buildPrompt, buildSources, MAX_OUTPUT_TOKENS, MAX_PASSAGES, REPORT_PROCESSES, type ContextProcess } from "./prompt";
import {
    failChatTurn,
    finishChatTurn,
    getCreditsAvailable,
    getModelRate,
    listContextProcesses,
    listThreadMessages,
    retrievePassages,
    startChatTurn,
} from "./repository";
import { canChat } from "./rbac";
import type { ChatContext, ChatMessageMetadata, ChatRequest, ChatUIMessage } from "./schemas";

const HISTORY_MESSAGES = 6;
// A typical answer, for the cost shown before asking.
const TYPICAL_INPUT_TOKENS = 12_000;
const TYPICAL_OUTPUT_TOKENS = 800;

const isRelevant = (match: SearchRunMatch) => match.relevance === "muy_relevante" || match.relevance === "posible";

/** The context's processes, each with the run's frozen copy when there is a run. */
async function loadContextProcesses(orgId: string, context: ChatContext): Promise<ContextProcess[]> {
    if (context.type === "opportunity" && context.runId === null) {
        return (await listContextProcesses([context.processId])).map((process) => ({ ...process, snapshot: null }));
    }

    const orgRun = await getOrgRun(orgId, context.runId!);
    if (!orgRun) throw new UserFacingError("La actualización no existe o ya no está disponible en su plan.");
    const matches = await listSearchRunMatches(orgRun.run.id);
    const chosen =
        context.type === "opportunity"
            ? matches.filter((match) => match.processId === context.processId)
            : matches.filter(isRelevant).slice(0, REPORT_PROCESSES);
    if (context.type === "report" && chosen.length === 0) {
        throw new UserFacingError("Esta actualización no tiene oportunidades relevantes para consultar.");
    }

    const snapshots = new Map(chosen.map((match) => [match.processId, { stage: match.stage, closesAt: match.closesAt, runAt: orgRun.run.createdAt, relevance: match.relevance }]));
    const ids = context.type === "opportunity" ? [context.processId] : chosen.map((match) => match.processId);
    return (await listContextProcesses(ids)).map((process) => ({ ...process, snapshot: snapshots.get(process.processId) ?? null }));
}

/** Embeds the question and finds its passages, skipped when no document of the context has text to search. */
async function findPassages(processes: ContextProcess[], question: string) {
    const searchable = processes.some((process) => process.documents.some((document) => document.readability === "read" || document.readability === "partial"));
    if (!searchable) return { passages: [], embeddingModel: null, embeddingTokens: null };

    const embeddingModel = modelForRole("embed");
    const { embedding, usage } = await embed({
        model: embeddingModel,
        value: question,
        providerOptions: { voyage: { inputType: "query", outputDimension: EMBEDDING_DIMENSIONS } },
    });
    const passages = await retrievePassages({
        processIds: processes.map((process) => process.processId),
        question,
        embedding,
        embeddingModel,
        limit: MAX_PASSAGES,
    });
    return { passages, embeddingModel, embeddingTokens: usage.tokens ?? null };
}

/**
 * Builds the sources and prompt for a question and reserves its credits
 * (plan §5.3, §5.4). Throws UserFacingError, or a database error with a code
 * from start_chat_turn (insufficient_credits, chat_turn_exists, ...).
 */
export async function startChatTurnService(params: { orgId: string; userId: string; request: ChatRequest }) {
    const { orgId, userId, request } = params;
    const role = await getUserOrgRole({ userId, orgId });
    if (!role || !canChat(role)) throw new UserFacingError("Su rol no le permite hacer preguntas.");
    const available = await getCreditsAvailable(orgId);
    if (available === null) throw new UserFacingError("La organización no tiene un plan activo.");
    if (available < 1) throw new UserFacingError("La organización usó todos sus créditos de este mes.");

    const question = request.message.text;
    const [processes, stored] = await Promise.all([loadContextProcesses(orgId, request.context), listThreadMessages(orgId, request.context)]);
    if (processes.length === 0) throw new UserFacingError("El proceso no existe.");

    const { passages, embeddingModel, embeddingTokens } = await findPassages(processes, question);
    const sources = buildSources(processes, passages);
    const history = stored
        .filter((message) => message.status === "completed")
        .slice(-HISTORY_MESSAGES)
        .map(({ role: messageRole, content, citations }) => ({ role: messageRole, content, citations }));
    const prompt = buildPrompt({ isReport: request.context.type === "report", sources, history, question });

    const model = modelForRole("chat");
    const turn = await startChatTurn({
        orgId,
        context: request.context,
        question,
        clientMessageId: request.message.id,
        model,
        estimatedInputTokens: prompt.estimatedInputTokens,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
    });

    return { ...turn, model, sources, prompt, embeddingModel, embeddingTokens };
}

type StartedTurn = Awaited<ReturnType<typeof startChatTurnService>>;

/**
 * Validates the answer's citations, stores it, and charges its usage; a
 * failed answer gives its credits back. Runs once per turn, whether or not
 * the user is still reading the stream.
 */
export async function settleChatTurnService(
    turn: StartedTurn,
    answer: Promise<{ text: string; inputTokens: number | undefined; outputTokens: number | undefined; model: string }>,
    startedAt: number,
): Promise<ChatMessageMetadata> {
    try {
        const result = await answer;
        if (!result.text.trim()) throw new Error("The model returned an empty answer");

        const { content, citations, unverified } = validateCitations(result.text, turn.sources);
        const { creditsCharged, creditsAvailable } = await finishChatTurn({
            assistantMessageId: turn.assistantMessageId,
            content,
            citations,
            unverified,
            model: result.model,
            // The gateway reports usage for every chat model; the estimate only covers a missing report.
            inputTokens: result.inputTokens ?? turn.prompt.estimatedInputTokens,
            outputTokens: result.outputTokens ?? Math.ceil(result.text.length / 3),
            latencyMs: Math.round(performance.now() - startedAt),
            embeddingModel: turn.embeddingModel,
            embeddingTokens: turn.embeddingTokens,
        });
        return { status: "completed", citations, unverified, creditsCharged, creditsAvailable };
    } catch (error) {
        console.error("Chat answer failed:", error);
        await failChatTurn(turn.assistantMessageId, error instanceof Error ? error.message : String(error));
        return { status: "failed" };
    }
}

/** What the chat panel needs: the conversation so far, the credits, and whether the user can ask. */
export async function getChatPanelService(params: { orgId: string; userId: string; context: ChatContext }) {
    const [role, messages, creditsAvailable, rate] = await Promise.all([
        getUserOrgRole({ userId: params.userId, orgId: params.orgId }),
        listThreadMessages(params.orgId, params.context),
        getCreditsAvailable(params.orgId),
        getModelRate(modelForRole("chat")),
    ]);

    const initialMessages: ChatUIMessage[] = messages.map((message) => ({
        id: message.id,
        role: message.role,
        parts: [{ type: "text", text: message.content }],
        metadata:
            message.role === "assistant"
                ? { status: message.status, citations: message.citations, unverified: message.unverified, creditsCharged: message.creditsCharged ?? undefined }
                : undefined,
    }));
    const typicalCredits = rate
        ? Math.max(1, Math.ceil((TYPICAL_INPUT_TOKENS / 1000) * rate.input + (TYPICAL_OUTPUT_TOKENS / 1000) * rate.output))
        : null;

    return { initialMessages, creditsAvailable, typicalCredits, canChat: role !== null && canChat(role) && rate !== null };
}
