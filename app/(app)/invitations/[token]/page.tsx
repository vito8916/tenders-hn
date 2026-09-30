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
import { InvitationCardSkeleton } from "@/components/shared/invitation-card-skeleton";

function InvitationNotice({ title, description }: { title: string; description: string }) {
    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle className="text-2xl">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild variant="outline" className="w-full">
                    <Link href="/organizations">Ir a sus organizaciones</Link>
                </Button>
            </CardContent>
        </Card>
    );
}

async function InvitationContent({ params }: { params: Promise<{ token: string }> }) {
    await connection();
    const { token } = await params;
    const user = await getCurrentUser();
    const invitation = await getInvitationPreviewService({ token });

    if (!invitation) {
        return (
            <InvitationNotice
                title="Invitación no encontrada"
                description="Este enlace de invitación no es válido. Pida al administrador de la organización que le envíe uno nuevo."
            />
        );
    }

    if (invitation.acceptedAt) {
        return (
            <InvitationNotice
                title="Invitación ya aceptada"
                description={`Esta invitación a ${invitation.orgName} ya fue aceptada.`}
            />
        );
    }

    if (invitation.expiresAt < new Date()) {
        return (
            <InvitationNotice
                title="Invitación vencida"
                description={`Esta invitación a ${invitation.orgName} está vencida. Pida al administrador de la organización que le envíe una nueva.`}
            />
        );
    }

    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        return (
            <InvitationNotice
                title="Correo electrónico distinto"
                description={`Esta invitación se envió a ${invitation.email}, pero usted inició sesión como ${user.email}. Inicie sesión con el correo invitado para aceptarla.`}
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
            <Suspense fallback={<InvitationCardSkeleton />}>
                <InvitationContent params={params} />
            </Suspense>
        </main>
    );
}
