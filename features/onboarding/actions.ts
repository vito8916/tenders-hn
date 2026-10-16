"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createOrganizationWithCompanyInputSchema } from "@/features/organizations/schemas";
import { createOrganizationWithCompanyProfileService } from "@/features/organizations/services";
import { markOnboardingCompleteService } from "@/features/profiles/services";
import { databaseErrorCode, userErrorMessage } from "@/lib/errors";

const ONBOARDING_ERROR_MESSAGE = "No se pudo completar la configuración inicial. Intente de nuevo.";

/**
 * Server action for the plan step: creates the organization with what the company sells and
 * marks onboarding complete, so Paddle's checkout can carry the organization's id. The URL
 * identifier comes from the name; an abandoned checkout leaves an organization that asks for a plan.
 */
export async function createOnboardingOrganizationAction(input: unknown): Promise<
    { success: true; orgId: string; orgSlug: string } | { success: false; error: string }
> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = createOrganizationWithCompanyInputSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Revise los datos de la empresa." };
        }

        const organization = await createOrganizationWithCompanyProfileService({ ownerId: userId, input: parsed.data });

        await markOnboardingCompleteService({ userId });

        return { success: true, orgId: organization.id, orgSlug: organization.slug };
    } catch (error) {
        console.error("Onboarding completion error:", error);
        return {
            success: false,
            error:
                databaseErrorCode(error) === "organizations_slug_key"
                    ? "Otra organización tomó esa dirección al mismo tiempo. Intente de nuevo."
                    : userErrorMessage(error, ONBOARDING_ERROR_MESSAGE),
        };
    }
}

/**
 * Server action to complete onboarding for invited users: marks it complete without
 * creating an organization (the user joined one via invitation, or will browse theirs).
 */
export async function completeOnboardingWithoutOrgAction(joinedOrgSlug: string | null): Promise<{
    success: false;
    error: string;
}> {
    try {
        const { sub: userId } = await getCurrentUser();

        await markOnboardingCompleteService({ userId });
    } catch (error) {
        console.error("Onboarding completion error:", error);
        return {
            success: false,
            error: userErrorMessage(error, ONBOARDING_ERROR_MESSAGE),
        };
    }

    redirect(joinedOrgSlug ? `/organizations/${encodeURIComponent(joinedOrgSlug)}` : "/organizations");
}
