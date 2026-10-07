import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserWithProfile } from "@/lib/auth/get-current-user";
import { OnboardingStepper } from "@/features/onboarding/components/onboarding-stepper";
import { listMyPendingInvitationsService } from "@/features/invitations/services";
import { listOrganizationsByUserService } from "@/features/organizations/services";
import { OnboardingSkeleton } from "@/components/shared/onboarding-skeleton";
import { getImprovementsRemainingService } from "@/features/company-profile/services";
import { listPlansForSaleService } from "@/features/billing/services";

// ?plan= carries the plan chosen on the landing page through sign-up and email verification.
type OnboardingSearchParams = Promise<{ plan?: string }>;

async function OnboardingContent({ searchParams }: { searchParams: OnboardingSearchParams }) {
    const [{ user, profile }, { plan }] = await Promise.all([getCurrentUserWithProfile(), searchParams]);

    if (profile.onboardingCompletedAt) {
        redirect("/organizations");
    }

    const [pendingInvitations, organizations, improvementsRemaining, plans] = await Promise.all([
        listMyPendingInvitationsService(),
        listOrganizationsByUserService({ userId: user.sub }),
        getImprovementsRemainingService(),
        listPlansForSaleService(),
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
            plans={plans}
            preselectedPlanId={plans.some((option) => option.planId === plan) ? (plan ?? null) : null}
        />
    );
}

export const metadata = { title: "Bienvenida" };

export default function OnboardingPage({ searchParams }: { searchParams: OnboardingSearchParams }) {
    return (
        <Suspense fallback={<OnboardingSkeleton />}>
            <OnboardingContent searchParams={searchParams} />
        </Suspense>
    );
}
