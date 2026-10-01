import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getChatPanelService } from "../services";
import type { ChatContext } from "../schemas";
import { ChatPanel } from "./chat-panel";

const OPPORTUNITY_SUGGESTIONS = [
    "¿Qué documentos piden con la oferta?",
    "¿Cuál es la garantía de mantenimiento de oferta?",
    "¿Dónde y hasta cuándo se entregan las ofertas?",
    "Resuma las especificaciones técnicas",
];

const REPORT_SUGGESTIONS = [
    "¿Cuáles vencen en los próximos 7 días?",
    "Resuma las oportunidades muy relevantes",
    "¿Cuáles piden garantía de mantenimiento de oferta?",
];

/** The user's conversation about an opportunity or a report, loaded on the server. */
export async function ContextChat({ orgId, orgSlug, context }: { orgId: string; orgSlug: string; context: ChatContext }) {
    const { sub: userId } = await getCurrentUser();
    const { initialMessages, creditsAvailable, typicalCredits, canChat } = await getChatPanelService({ orgId, userId, context });

    return (
        <ChatPanel
            orgSlug={orgSlug}
            context={context}
            initialMessages={initialMessages}
            initialCredits={creditsAvailable}
            typicalCredits={typicalCredits}
            canChat={canChat}
            suggestions={context.type === "opportunity" ? OPPORTUNITY_SUGGESTIONS : REPORT_SUGGESTIONS}
            emptyDescription={
                context.type === "opportunity"
                    ? "Las respuestas salen de los datos del proceso y de sus documentos, con la página de cada fuente. Solo usted ve esta conversación."
                    : "Las respuestas cubren las oportunidades relevantes de esta ejecución (hasta 20), con la página de cada fuente. Solo usted ve esta conversación."
            }
        />
    );
}
