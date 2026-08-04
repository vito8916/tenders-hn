import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserWithProfile } from "@/lib/auth/get-current-user";
import { OnboardingStepper } from "@/features/onboarding/components/onboarding-stepper";
import { listMyPendingInvitationsService } from "@/features/invitations/services";
import { listOrganizationsByUserService } from "@/features/organizations/services";
import { Skeleton } from "@/components/ui/skeleton";

async function OnboardingContent() {
    const { user, profile } = await getCurrentUserWithProfile();

    if (profile.onboardingCompletedAt) {
        redirect("/organizations");
    }

    const [pendingInvitations, organizations] = await Promise.all([
        listMyPendingInvitationsService(),
        listOrganizationsByUserService({ userId: user.sub }),
    ]);

    return (
        <OnboardingStepper
            defaultProfile={{
                fullName: profile.fullName || "",
                phone: profile.phone || "",
                email: user.email || "",
                avatarUrl: profile.avatarUrl,
            }}
            pendingInvitations={pendingInvitations.map((invitation) => ({
                id: invitation.id,
                orgName: invitation.orgName,
                orgSlug: invitation.orgSlug,
                role: invitation.role,
                token: invitation.token,
            }))}
            hasExistingMembership={organizations.length > 0}
        />
    );
}

function OnboardingSkeleton() {
    return (
        <div className="w-full space-y-6">
            <Skeleton className="mx-auto h-8 w-64" />
            <Skeleton className="h-64 w-full rounded-xl" />
        </div>
    );
}

export default function OnboardingPage() {
    return (
        <Suspense fallback={<OnboardingSkeleton />}>
            <OnboardingContent />
        </Suspense>
    );
}
