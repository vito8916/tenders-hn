"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Mail, Trash2 } from "lucide-react";
import { ROLE_LABELS } from "@/features/memberships/schemas";
import type { PendingInvitation } from "../schemas";
import { resendInvitationAction, revokeInvitationAction } from "../actions";

interface PendingInvitationsTableProps {
    invitations: PendingInvitation[];
    orgId: string;
    orgSlug: string;
}

export function PendingInvitationsTable({ invitations, orgId, orgSlug }: PendingInvitationsTableProps) {
    const [isPending, startTransition] = useTransition();

    if (invitations.length === 0) {
        return (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No hay invitaciones pendientes.
            </p>
        );
    }

    function handleResend(invitationId: string) {
        startTransition(async () => {
            const result = await resendInvitationAction({ orgId, orgSlug, invitationId });
            if (result.success) {
                toast.success("Invitación reenviada");
            } else {
                toast.error(result.error ?? "No se pudo reenviar la invitación");
            }
        });
    }

    function handleRevoke(invitationId: string) {
        startTransition(async () => {
            const result = await revokeInvitationAction({ orgId, orgSlug, invitationId });
            if (result.success) {
                toast.success("Invitación revocada");
            } else {
                toast.error(result.error ?? "No se pudo revocar la invitación");
            }
        });
    }

    return (
        <div className="rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Correo electrónico</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Vence</TableHead>
                        <TableHead className="w-24" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invitations.map((invitation) => {
                        const isExpired = invitation.expiresAt < new Date();

                        return (
                            <TableRow key={invitation.id}>
                                <TableCell className="text-sm">{invitation.email}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary">{ROLE_LABELS[invitation.role]}</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {isExpired ? (
                                        <Badge variant="destructive">Vencida</Badge>
                                    ) : (
                                        invitation.expiresAt.toLocaleDateString("es-HN", { timeZone: "America/Tegucigalpa" })
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-1">
                                        {!isExpired ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                disabled={isPending}
                                                onClick={() => handleResend(invitation.id)}
                                            >
                                                <Mail className="size-4" />
                                                <span className="sr-only">Reenviar invitación</span>
                                            </Button>
                                        ) : null}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={isPending}
                                            onClick={() => handleRevoke(invitation.id)}
                                        >
                                            <Trash2 className="size-4" />
                                            <span className="sr-only">Revocar invitación</span>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
