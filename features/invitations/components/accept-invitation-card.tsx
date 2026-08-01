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
import { acceptInvitationAction } from "../actions";

interface AcceptInvitationCardProps {
    token: string;
    orgName: string;
    role: string;
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
                <CardTitle className="text-2xl">Join {orgName}</CardTitle>
                <CardDescription>
                    You have been invited to join <strong>{orgName}</strong> as{" "}
                    <Badge variant="secondary">{role}</Badge>
                </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
                This invitation was sent to <strong>{invitedEmail}</strong>. Accepting
                it will add you to the organization with the role above.
                {error ? <p className="mt-3 text-destructive">{error}</p> : null}
            </CardContent>
            <CardFooter>
                <Button className="w-full" onClick={handleAccept} disabled={isPending}>
                    {isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Joining...
                        </>
                    ) : (
                        "Accept invitation"
                    )}
                </Button>
            </CardFooter>
        </Card>
    );
}
