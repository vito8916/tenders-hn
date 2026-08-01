"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Building2, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { acceptInvitationDuringOnboardingAction } from "@/features/invitations/actions";

export interface JoinableInvitation {
    id: string;
    orgName: string;
    orgSlug: string;
    role: string;
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
                toast.success(`Joined ${result.orgName ?? invitation.orgName}`);
            } else {
                toast.error(result.error ?? "Failed to join the organization");
            }
        });
    }

    return (
        <div className="w-full space-y-8">
            <div>
                <h2 className="text-2xl font-bold">Join your team</h2>
                <p className="text-muted-foreground mt-1">
                    {invitations.length > 0
                        ? "You have pending invitations. Join your team to get started."
                        : "You are already a member of an organization, so there is nothing else to set up."}
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
                                        <Badge variant="secondary" className="capitalize">
                                            {invitation.role}
                                        </Badge>
                                    </div>
                                </div>
                                {joined ? (
                                    <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                                        <Check className="size-4" />
                                        Joined
                                    </span>
                                ) : (
                                    <Button
                                        onClick={() => handleJoin(invitation)}
                                        disabled={isJoining || pendingId !== null}
                                    >
                                        {isJoining ? (
                                            <>
                                                <Loader2 className="mr-2 size-4 animate-spin" />
                                                Joining...
                                            </>
                                        ) : (
                                            "Join"
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
                    Finish to go to your organizations.
                </p>
            ) : null}

            <button
                type="button"
                onClick={onCreateInstead}
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
            >
                I want to create my own organization instead
            </button>
        </div>
    );
}
