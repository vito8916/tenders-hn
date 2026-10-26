"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveTrackingAction } from "../actions";
import { STATUS_LABELS, TrackingStatusSchema, type Assignee, type Tracking, type TrackingStatus } from "../schemas";

const updatedAt = new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa" });

const NO_ASSIGNEE = "ninguno";

/**
 * The opportunity's status and assignee (spec 0.4 §5), saved as soon as they change, and a reason when
 * it is discarded. «Nueva» clears the tracking; assigning someone to a «Nueva» one starts its evaluation.
 * The parent keys it by the last change, so a saved change resets it.
 */
export function TrackingForm({
    orgId,
    orgSlug,
    processId,
    tracking,
    assignees,
    canTrack,
}: {
    orgId: string;
    orgSlug: string;
    processId: string;
    tracking: Tracking | null;
    assignees: Assignee[];
    canTrack: boolean;
}) {
    const [status, setStatus] = useState<TrackingStatus | null>(tracking?.status ?? null);
    const [assignedTo, setAssignedTo] = useState(tracking?.assignedTo ?? null);
    const [reason, setReason] = useState(tracking?.discardReason ?? "");
    const [isPending, startTransition] = useTransition();

    const save = (changes: { status: TrackingStatus | null; assignedTo: string | null }) =>
        startTransition(async () => {
            const result = await saveTrackingAction({ orgId, orgSlug, processId, ...changes, discardReason: reason });
            if (!result.success) {
                toast.error(result.error ?? "No se pudo guardar.");
                setStatus(tracking?.status ?? null);
                setAssignedTo(tracking?.assignedTo ?? null);
            }
        });

    const changeStatus = (value: string) => {
        const next = value === "nueva" ? null : TrackingStatusSchema.parse(value);
        setStatus(next);
        // Back to «Nueva» there is nobody responsible.
        const nextAssignee = next === null ? null : assignedTo;
        setAssignedTo(nextAssignee);
        save({ status: next, assignedTo: nextAssignee });
    };
    const changeAssignee = (value: string) => {
        const next = value === NO_ASSIGNEE ? null : value;
        setAssignedTo(next);
        if (next && status === null) setStatus("en_evaluacion");
        save({ status, assignedTo: next });
    };

    const reasonChanged = tracking?.status === "descartada" && reason.trim() !== (tracking.discardReason ?? "");

    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label htmlFor={`estado-${processId}`}>Estado</Label>
                    <Select value={status ?? "nueva"} onValueChange={changeStatus} disabled={!canTrack || isPending}>
                        <SelectTrigger id={`estado-${processId}`} className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor={`responsable-${processId}`}>Responsable</Label>
                    <Select value={assignedTo ?? NO_ASSIGNEE} onValueChange={changeAssignee} disabled={!canTrack || isPending}>
                        <SelectTrigger id={`responsable-${processId}`} className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NO_ASSIGNEE}>Sin responsable</SelectItem>
                            {assignees.map((assignee) => (
                                <SelectItem key={assignee.userId} value={assignee.userId}>
                                    {assignee.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {status === "descartada" ? (
                canTrack ? (
                    <div className="space-y-1.5">
                        <Label htmlFor={`motivo-${processId}`} className="text-muted-foreground">
                            Motivo del descarte (opcional)
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
                            <Button size="sm" variant="secondary" disabled={isPending} onClick={() => save({ status, assignedTo })}>
                                Guardar motivo
                            </Button>
                        ) : null}
                    </div>
                ) : tracking?.discardReason ? (
                    <p className="text-sm text-muted-foreground">Motivo del descarte: {tracking.discardReason}</p>
                ) : null
            ) : null}

            {tracking ? (
                <p className="text-xs text-muted-foreground">
                    Actualizado {tracking.updatedByName ? `por ${tracking.updatedByName} ` : ""}el {updatedAt.format(new Date(tracking.updatedAt))}
                </p>
            ) : null}
        </div>
    );
}
