import { RelevanceBadge as SoftRelevanceBadge } from "@/components/marketing/relevance-badge";
import type { Relevance } from "../schemas";

const SOFT_RELEVANCE = {
    muy_relevante: "high",
    posible: "possible",
    pendiente: "pending",
    descartada: "discarded",
} as const;

export function RelevanceBadge({ relevance }: { relevance: Relevance }) {
    return <SoftRelevanceBadge relevance={SOFT_RELEVANCE[relevance]} />;
}
