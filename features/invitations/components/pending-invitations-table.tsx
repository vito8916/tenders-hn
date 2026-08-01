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
                No pending invitations.
            </p>
        );
    }

    function handleResend(invitationId: string) {
        startTransition(async () => {
            const result = await resendInvitationAction({ orgId, orgSlug, invitationId });
            if (result.success) {
                toast.success("Invitation email resent");
            } else {
                toast.error(result.error ?? "Failed to resend invitation");
            }
        });
    }

    function handleRevoke(invitationId: string) {
        startTransition(async () => {
            const result = await revokeInvitationAction({ orgId, orgSlug, invitationId });
            if (result.success) {
                toast.success("Invitation revoked");
            } else {
                toast.error(result.error ?? "Failed to revoke invitation");
            }
        });
    }

    return (
        <div className="rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Expires</TableHead>
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
                                    <Badge variant="secondary" className="capitalize">
                                        {invitation.role}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {isExpired ? (
                                        <Badge variant="destructive">Expired</Badge>
                                    ) : (
                                        invitation.expiresAt.toLocaleDateString()
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
                                                <span className="sr-only">Resend invitation</span>
                                            </Button>
                                        ) : null}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={isPending}
                                            onClick={() => handleRevoke(invitation.id)}
                                        >
                                            <Trash2 className="size-4" />
                                            <span className="sr-only">Revoke invitation</span>
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
