import { createUIMessageStream, createUIMessageStreamResponse, streamText, toUIMessageStream } from "ai";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { userErrorMessage } from "@/lib/errors";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { chatRequestSchema, type ChatUIMessage } from "@/features/chat/schemas";
import { MAX_OUTPUT_TOKENS } from "@/features/chat/prompt";
import { settleChatTurnService, startChatTurnService } from "@/features/chat/services";

/**
 * A question to the chat (spec §8), with the user's session. The answer
 * streams; once it ends, its citations are validated, it is stored, and its
 * credits are charged, and the last chunk tells the browser which citations
 * held and what it cost. The model runs to the end even if the browser stops
 * reading, so a stopped answer is stored and charged once.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orgSlug: string }> }) {
    const { orgSlug } = await params;
    const [{ sub: userId }, organization] = await Promise.all([getCurrentUser(), getOrganizationBySlugService(orgSlug)]);
    if (!organization) {
        return new Response("No se encontró la organización.", { status: 404 });
    }

    const parsed = chatRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
        return new Response(parsed.error.issues[0]?.message ?? "Datos no válidos.", { status: 400 });
    }

    let turn: Awaited<ReturnType<typeof startChatTurnService>>;
    try {
        turn = await startChatTurnService({ orgId: organization.id, userId, request: parsed.data });
    } catch (error) {
        console.error("Error starting a chat turn:", error);
        return new Response(userErrorMessage(error, "No se pudo enviar la pregunta. Intente de nuevo."), { status: 400 });
    }

    const startedAt = performance.now();
    const result = streamText({
        model: turn.model,
        instructions: turn.prompt.instructions,
        messages: turn.prompt.messages,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
    // Reads the answer to the end even when the browser stops reading.
    result.consumeStream();

    const settled = settleChatTurnService(
        turn,
        Promise.all([result.text, result.usage, result.response]).then(([text, usage, response]) => ({
            text,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            model: response.modelId,
        })),
        startedAt,
    );

    const stream = createUIMessageStream<ChatUIMessage>({
        execute: async ({ writer }) => {
            writer.write({ type: "start", messageId: turn.assistantMessageId, messageMetadata: { status: "pending" } });
            const answerStreamed = new Promise<void>((resolve) => {
                writer.merge(toUIMessageStream({ stream: result.stream, sendStart: false, sendFinish: false, onEnd: () => resolve() }));
            });
            const [metadata] = await Promise.all([settled, answerStreamed]);
            writer.write({ type: "message-metadata", messageMetadata: metadata });
            writer.write({ type: "finish" });
        },
        onError: () => "No se pudo completar la respuesta. Los créditos reservados se devolvieron.",
    });

    return createUIMessageStreamResponse({ stream });
}
