import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserWithProfile } from "@/lib/auth/get-current-user";
import { OnboardingStepper } from "@/features/onboarding/components/onboarding-stepper";
import { listMyPendingInvitationsService } from "@/features/invitations/services";
import { listOrganizationsByUserService } from "@/features/organizations/services";
import { OnboardingSkeleton } from "@/components/shared/onboarding-skeleton";
import { getImprovementsRemainingService } from "@/features/company-profile/services";

async function OnboardingContent() {
    const { user, profile } = await getCurrentUserWithProfile();

    if (profile.onboardingCompletedAt) {
        redirect("/organizations");
    }

    const [pendingInvitations, organizations, improvementsRemaining] = await Promise.all([
        listMyPendingInvitationsService(),
        listOrganizationsByUserService({ userId: user.sub }),
        getImprovementsRemainingService(),
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
            improvementsRemaining={improvementsRemaining}
        />
    );
}

export default function OnboardingPage() {
    return (
        <Suspense fallback={<OnboardingSkeleton />}>
            <OnboardingContent />
        </Suspense>
    );
}
