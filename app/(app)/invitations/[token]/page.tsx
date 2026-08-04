import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getInvitationPreviewService } from "@/features/invitations/services";
import { AcceptInvitationCard } from "@/features/invitations/components/accept-invitation-card";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function InvitationNotice({ title, description }: { title: string; description: string }) {
    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle className="text-2xl">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild variant="outline" className="w-full">
                    <Link href="/organizations">Go to your organizations</Link>
                </Button>
            </CardContent>
        </Card>
    );
}

function InvitationSkeleton() {
    return <Skeleton className="h-64 w-full max-w-md rounded-xl" />;
}

async function InvitationContent({ params }: { params: Promise<{ token: string }> }) {
    await connection();
    const { token } = await params;
    const user = await getCurrentUser();
    const invitation = await getInvitationPreviewService({ token });

    if (!invitation) {
        return (
            <InvitationNotice
                title="Invitation not found"
                description="This invitation link is invalid. Ask the organization admin to send you a new one."
            />
        );
    }

    if (invitation.acceptedAt) {
        return (
            <InvitationNotice
                title="Already accepted"
                description={`This invitation to ${invitation.orgName} has already been accepted.`}
            />
        );
    }

    if (invitation.expiresAt < new Date()) {
        return (
            <InvitationNotice
                title="Invitation expired"
                description={`This invitation to ${invitation.orgName} has expired. Ask the organization admin to send you a new one.`}
            />
        );
    }

    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        return (
            <InvitationNotice
                title="Different email address"
                description={`This invitation was sent to ${invitation.email}, but you are signed in as ${user.email}. Sign in with the invited email to accept it.`}
            />
        );
    }

    return (
        <AcceptInvitationCard
            token={token}
            orgName={invitation.orgName}
            role={invitation.role}
            invitedEmail={invitation.email}
        />
    );
}

export default function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
    return (
        <main className="flex min-h-svh items-center justify-center p-6">
            <Suspense fallback={<InvitationSkeleton />}>
                <InvitationContent params={params} />
            </Suspense>
        </main>
    );
}
