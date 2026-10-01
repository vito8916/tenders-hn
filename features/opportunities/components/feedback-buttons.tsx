"use client";

import { useState, useTransition } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveFeedbackAction } from "../actions";
import type { Feedback, FeedbackDecision } from "../schemas";

const decidedAt = new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa" });

/** «Me interesa» / «No me interesa» with an optional reason; choosing the marked one again clears it. */
export function FeedbackButtons({
    orgId,
    orgSlug,
    processId,
    feedback,
    canDecide,
}: {
    orgId: string;
    orgSlug: string;
    processId: string;
    feedback: Feedback | null;
    canDecide: boolean;
}) {
    const [reason, setReason] = useState(feedback?.reason ?? "");
    const [isPending, startTransition] = useTransition();

    const save = (decision: FeedbackDecision | null) =>
        startTransition(async () => {
            const result = await saveFeedbackAction({ orgId, orgSlug, processId, decision, reason: decision ? reason : undefined });
            if (!result.success) {
                toast.error(result.error ?? "No se pudo guardar.");
                return;
            }
            if (decision === null) setReason("");
        });

    const choose = (decision: FeedbackDecision) => save(feedback?.decision === decision ? null : decision);
    const reasonChanged = feedback !== null && reason.trim() !== (feedback.reason ?? "");

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                <Button variant={feedback?.decision === "interesa" ? "default" : "outline"} disabled={!canDecide || isPending} onClick={() => choose("interesa")}>
                    <ThumbsUp />
                    Me interesa
                </Button>
                <Button
                    variant={feedback?.decision === "no_interesa" ? "default" : "outline"}
                    disabled={!canDecide || isPending}
                    onClick={() => choose("no_interesa")}
                >
                    <ThumbsDown />
                    No me interesa
                </Button>
            </div>
            {canDecide ? (
                <div className="space-y-1.5">
                    <Label htmlFor={`motivo-${processId}`} className="text-muted-foreground">
                        Motivo (opcional)
                    </Label>
                    <Textarea
                        id={`motivo-${processId}`}
                        value={reason}
                        maxLength={1000}
                        rows={2}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Por ejemplo: no entregamos en ese departamento"
                    />
                    {reasonChanged ? (
                        <Button size="sm" variant="secondary" disabled={isPending} onClick={() => save(feedback.decision)}>
                            Guardar motivo
                        </Button>
                    ) : null}
                </div>
            ) : feedback?.reason ? (
                <p className="text-sm text-muted-foreground">Motivo: {feedback.reason}</p>
            ) : null}
            {feedback ? (
                <p className="text-xs text-muted-foreground">
                    Marcada {feedback.decidedByName ? `por ${feedback.decidedByName} ` : ""}el {decidedAt.format(new Date(feedback.decidedAt))}
                </p>
            ) : null}
        </div>
    );
}
