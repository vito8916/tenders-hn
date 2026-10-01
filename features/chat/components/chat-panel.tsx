"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ExternalLink, MessageSquareText, TriangleAlert } from "lucide-react";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { InlineCitation, InlineCitationBody, InlineCitationSource, InlineCitationTrigger } from "@/components/ai-elements/inline-citation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { citationLabel, toCitationMarkup } from "../citations";
import type { ChatContext, ChatUIMessage, Citation } from "../schemas";

const textOf = (message: ChatUIMessage) =>
    message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");

const credits = (count: number) => (count === 1 ? "1 crédito" : `${count} créditos`);

// Spanish labels for Streamdown's link confirmation.
const STREAMDOWN_TRANSLATIONS = {
    openExternalLink: "Abrir enlace externo",
    externalLinkWarning: "Va a abrir un enlace a otro sitio.",
    openLink: "Abrir enlace",
    copyLink: "Copiar enlace",
    copied: "Copiado",
    close: "Cerrar",
};

/** A citation marker of the answer: its sources, numbered as in the list below the answer. */
function CitationChip({ ids, citations }: { ids: string[]; citations: Citation[] | undefined }) {
    const cited = ids.flatMap((id) => citations?.find((citation) => citation.id === id) ?? []);
    if (!citations || cited.length === 0) {
        return <span className="mx-0.5 rounded-full bg-muted px-1.5 text-[0.7rem] text-muted-foreground">{ids.join(", ")}</span>;
    }
    const numbers = cited.map((citation) => citations.indexOf(citation) + 1);
    return (
        <InlineCitation>
            <InlineCitationTrigger aria-label={`Fuente ${numbers.join(", ")}`}>{numbers.join(", ")}</InlineCitationTrigger>
            <InlineCitationBody>
                {cited.map((citation) => (
                    <InlineCitationSource key={citation.id} title={citationLabel(citation)} description={citation.kind === "document" ? citation.expediente : undefined}>
                        <a href={citation.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            {citation.kind === "process" ? "Ver en HonduCompras" : "Abrir el documento oficial"} <ExternalLink className="size-3" />
                        </a>
                    </InlineCitationSource>
                ))}
            </InlineCitationBody>
        </InlineCitation>
    );
}

function AssistantMessage({ message, isStreaming }: { message: ChatUIMessage; isStreaming: boolean }) {
    const { status, citations, unverified, creditsCharged } = message.metadata ?? {};
    const text = textOf(message);
    const components = useMemo(
        () => ({ cita: ({ ids }: { ids?: string }) => <CitationChip ids={(ids ?? "").split(",")} citations={citations} /> }),
        [citations],
    );

    if (status === "failed") {
        return <p className="text-sm text-muted-foreground">No se pudo completar esta respuesta. Los créditos reservados se devolvieron.</p>;
    }
    if (!text) {
        return <p className="text-sm text-muted-foreground">{isStreaming ? "Buscando en los documentos…" : "La respuesta todavía se está escribiendo. Vuelva a abrir el panel en un momento."}</p>;
    }

    return (
        <>
            <MessageResponse
                isAnimating={isStreaming}
                allowedTags={{ cita: ["ids"] }}
                literalTagContent={["cita"]}
                components={components}
                controls={false}
                translations={STREAMDOWN_TRANSLATIONS}
            >
                {toCitationMarkup(text, citations)}
            </MessageResponse>
            {status === "completed" && unverified ? (
                <p className="flex items-start gap-1.5 rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                    Sin fuente verificada: parte de esta respuesta no cita una fuente que se pueda comprobar. Confírmela en los documentos oficiales.
                </p>
            ) : null}
            {citations && citations.length > 0 ? (
                <Sources>
                    <SourcesTrigger count={citations.length} />
                    <SourcesContent>
                        {citations.map((citation, index) => (
                            <Source key={citation.id} href={citation.url} title={`${index + 1}. ${citationLabel(citation)}`} />
                        ))}
                    </SourcesContent>
                </Sources>
            ) : null}
            {creditsCharged ? <p className="text-xs text-muted-foreground">Costo: {credits(creditsCharged)}</p> : null}
        </>
    );
}

/**
 * Questions about an opportunity or a report, answered from its documents
 * with verified sources (spec §8). Only the user who asks sees the
 * conversation.
 */
export function ChatPanel({
    orgSlug,
    context,
    initialMessages,
    initialCredits,
    typicalCredits,
    canChat,
    suggestions,
    emptyDescription,
}: {
    orgSlug: string;
    context: ChatContext;
    initialMessages: ChatUIMessage[];
    /** Credits left this cycle; null without an active plan. */
    initialCredits: number | null;
    typicalCredits: number | null;
    canChat: boolean;
    suggestions: string[];
    emptyDescription: string;
}) {
    const [transport] = useState(
        () =>
            new DefaultChatTransport<ChatUIMessage>({
                api: `/organizations/${orgSlug}/chat`,
                // The server keeps the conversation: only the new question goes.
                prepareSendMessagesRequest: ({ messages }) => {
                    const last = messages.at(-1);
                    return { body: { context, message: { id: last?.id ?? "", text: last ? textOf(last) : "" } } };
                },
            }),
    );
    const { messages, sendMessage, status, stop, error } = useChat<ChatUIMessage>({
        id: context.type === "opportunity" ? `oportunidad:${context.processId}` : `reporte:${context.runId}`,
        messages: initialMessages,
        transport,
    });

    const latestCredits = messages.findLast((message) => message.metadata?.creditsAvailable !== undefined)?.metadata?.creditsAvailable;
    const creditsAvailable = latestCredits ?? initialCredits;
    const outOfCredits = creditsAvailable !== null && creditsAvailable < 1;
    const blockedReason = !canChat
        ? "Su rol en la organización no permite hacer preguntas."
        : creditsAvailable === null
          ? "La organización no tiene un plan activo."
          : outOfCredits
            ? "La organización usó todos sus créditos de este mes."
            : null;
    const busy = status === "submitted" || status === "streaming";
    const ask = (text: string) => sendMessage({ text });

    return (
        <div className="flex h-full min-h-0 flex-col">
            <Conversation className="min-h-0">
                <ConversationContent>
                    {messages.length === 0 ? (
                        <ConversationEmptyState icon={<MessageSquareText className="size-6" />} title="Pregunte sobre los documentos" description={emptyDescription} />
                    ) : (
                        messages.map((message, index) => (
                            <Message key={message.id} from={message.role}>
                                <MessageContent>
                                    {message.role === "assistant" ? (
                                        <AssistantMessage message={message} isStreaming={busy && index === messages.length - 1} />
                                    ) : (
                                        <p className="whitespace-pre-line">{textOf(message)}</p>
                                    )}
                                </MessageContent>
                            </Message>
                        ))
                    )}
                    {error ? <p className="text-sm text-destructive">{error.message || "Algo salió mal. Intente de nuevo."}</p> : null}
                </ConversationContent>
                <ConversationScrollButton />
            </Conversation>

            <div className="space-y-3 border-t p-4">
                {messages.length === 0 && !blockedReason ? (
                    <Suggestions>
                        {suggestions.map((suggestion) => (
                            <Suggestion key={suggestion} suggestion={suggestion} onClick={ask} disabled={busy} />
                        ))}
                    </Suggestions>
                ) : null}
                <PromptInput onSubmit={ask}>
                    <PromptInputTextarea
                        placeholder={blockedReason ?? "Escriba su pregunta…"}
                        disabled={blockedReason !== null}
                        maxLength={2000}
                        aria-label="Pregunta"
                    />
                    <PromptInputFooter>
                        <p className="text-xs font-normal">
                            {creditsAvailable === null ? null : `Créditos disponibles: ${creditsAvailable}`}
                            {typicalCredits && creditsAvailable !== null ? ` · Cada pregunta usa normalmente ${credits(typicalCredits)}` : null}
                        </p>
                        <PromptInputSubmit status={status} onStop={stop} disabled={blockedReason !== null && !busy} />
                    </PromptInputFooter>
                </PromptInput>
                {outOfCredits ? (
                    <p className="text-xs text-muted-foreground">
                        Los créditos se renuevan con el plan.{" "}
                        <Link href={`/organizations/${orgSlug}/settings/billing`} className="text-primary hover:underline">
                            Ver facturación
                        </Link>
                    </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                    Las respuestas salen de los documentos publicados y pueden tener errores; confirme los datos en HonduCompras. No determinan si su empresa
                    cumple los requisitos.
                </p>
            </div>
        </div>
    );
}
