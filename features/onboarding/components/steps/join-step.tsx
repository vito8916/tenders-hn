"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Building2, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { acceptInvitationDuringOnboardingAction } from "@/features/invitations/actions";
import type { InviteRole } from "@/features/invitations/schemas";
import { ROLE_LABELS } from "@/features/memberships/schemas";

export interface JoinableInvitation {
    id: string;
    orgName: string;
    orgSlug: string;
    role: InviteRole;
    token: string;
}

interface JoinStepProps {
    invitations: JoinableInvitation[];
    hasExistingMembership: boolean;
    onJoined: (orgSlug: string) => void;
    onCreateInstead: () => void;
}

export function JoinStep({
    invitations,
    hasExistingMembership,
    onJoined,
    onCreateInstead,
}: JoinStepProps) {
    const [joinedIds, setJoinedIds] = useState<string[]>([]);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    function handleJoin(invitation: JoinableInvitation) {
        setPendingId(invitation.id);
        startTransition(async () => {
            const result = await acceptInvitationDuringOnboardingAction(invitation.token);
            setPendingId(null);

            if (result.success && result.orgSlug) {
                setJoinedIds((current) => [...current, invitation.id]);
                onJoined(result.orgSlug);
                toast.success(`Se unió a ${result.orgName ?? invitation.orgName}`);
            } else {
                toast.error(result.error ?? "No se pudo unir a la organización");
            }
        });
    }

    return (
        <div className="w-full space-y-8">
            <div>
                <h2 className="text-2xl font-bold">Únase a su equipo</h2>
                <p className="text-muted-foreground mt-1">
                    {invitations.length > 0
                        ? "Tiene invitaciones pendientes. Únase a su equipo para comenzar."
                        : "Usted ya es miembro de una organización, así que no hay nada más que configurar."}
                </p>
            </div>

            {invitations.length > 0 ? (
                <ul className="space-y-3">
                    {invitations.map((invitation) => {
                        const joined = joinedIds.includes(invitation.id);
                        const isJoining = pendingId === invitation.id;

                        return (
                            <li
                                key={invitation.id}
                                className="flex items-center justify-between gap-4 rounded-lg border p-4"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
                                        <Building2 className="size-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{invitation.orgName}</p>
                                        <Badge variant="secondary">{ROLE_LABELS[invitation.role]}</Badge>
                                    </div>
                                </div>
                                {joined ? (
                                    <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                                        <Check className="size-4" />
                                        Se unió
                                    </span>
                                ) : (
                                    <Button
                                        onClick={() => handleJoin(invitation)}
                                        disabled={isJoining || pendingId !== null}
                                    >
                                        {isJoining ? (
                                            <>
                                                <Loader2 className="mr-2 size-4 animate-spin" />
                                                Uniéndose…
                                            </>
                                        ) : (
                                            "Unirse"
                                        )}
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            ) : null}

            {hasExistingMembership && invitations.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Seleccione «Finalizar» para ir a sus organizaciones.
                </p>
            ) : null}

            <button
                type="button"
                onClick={onCreateInstead}
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
            >
                Prefiero crear mi propia organización
            </button>
        </div>
    );
}
