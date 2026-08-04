import Link from "next/link";
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

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

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

export default async function InvitationPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    const user = await getCurrentUser();
    const invitation = await getInvitationPreviewService({ token });

    let content;

    if (!invitation) {
        content = (
            <InvitationNotice
                title="Invitation not found"
                description="This invitation link is invalid. Ask the organization admin to send you a new one."
            />
        );
    } else if (invitation.acceptedAt) {
        content = (
            <InvitationNotice
                title="Already accepted"
                description={`This invitation to ${invitation.orgName} has already been accepted.`}
            />
        );
    } else if (invitation.expiresAt < new Date()) {
        content = (
            <InvitationNotice
                title="Invitation expired"
                description={`This invitation to ${invitation.orgName} has expired. Ask the organization admin to send you a new one.`}
            />
        );
    } else if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        content = (
            <InvitationNotice
                title="Different email address"
                description={`This invitation was sent to ${invitation.email}, but you are signed in as ${user.email}. Sign in with the invited email to accept it.`}
            />
        );
    } else {
        content = (
            <AcceptInvitationCard
                token={token}
                orgName={invitation.orgName}
                role={invitation.role}
                invitedEmail={invitation.email}
            />
        );
    }

    return (
        <main className="flex min-h-svh items-center justify-center p-6">
            {content}
        </main>
    );
}
