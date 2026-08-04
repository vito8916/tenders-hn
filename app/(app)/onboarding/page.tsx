import { getCurrentUserWithProfile } from "@/lib/auth/get-current-user";
import { redirect } from "next/navigation";
import { OnboardingStepper } from "@/features/onboarding/components/onboarding-stepper";
import { listMyPendingInvitationsService } from "@/features/invitations/services";
import { listOrganizationsByUserService } from "@/features/organizations/services";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function OnboardingPage() {
    const { user, profile } = await getCurrentUserWithProfile();

    if (profile.onboardingCompletedAt) {
        redirect("/organizations");
    }

    // Invited users get a join flow instead of creating an organization
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
