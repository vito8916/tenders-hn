"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { ROLE_LABELS } from "@/features/memberships/schemas";
import { acceptInvitationAction } from "../actions";
import type { InviteRole } from "../schemas";

interface AcceptInvitationCardProps {
    token: string;
    orgName: string;
    role: InviteRole;
    invitedEmail: string;
}

export function AcceptInvitationCard({ token, orgName, role, invitedEmail }: AcceptInvitationCardProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function handleAccept() {
        setError(null);
        startTransition(async () => {
            const result = await acceptInvitationAction(token);
            // acceptInvitationAction redirects on success, so a return value is always an error
            if (result?.error) {
                setError(result.error);
                toast.error(result.error);
            }
        });
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle className="text-2xl">Únase a {orgName}</CardTitle>
                <CardDescription>
                    Lo invitaron a unirse a <strong>{orgName}</strong> con el rol{" "}
                    <Badge variant="secondary">{ROLE_LABELS[role]}</Badge>
                </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
                Esta invitación se envió a <strong>{invitedEmail}</strong>. Al aceptarla,
                se unirá a la organización con el rol indicado.
                {error ? <p className="mt-3 text-destructive">{error}</p> : null}
            </CardContent>
            <CardFooter>
                <Button className="w-full" onClick={handleAccept} disabled={isPending}>
                    {isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uniéndose…
                        </>
                    ) : (
                        "Aceptar invitación"
                    )}
                </Button>
            </CardFooter>
        </Card>
    );
}
