import "server-only";
import { modelForRole } from "@/lib/ai/models";
import { UserFacingError } from "@/lib/errors";
import { improveField } from "./improve";
import {
    claimProfileImprovement,
    finishProfileImprovement,
    getCompanyProfile,
    getImprovementsRemaining,
    saveCompanyProfile,
} from "./repository";
import { canImproveField, type CompanyProfileInput, type ImproveProfileFieldInput } from "./schemas";

export async function getCompanyProfileService(orgId: string) {
    return getCompanyProfile(orgId);
}

/** Owners and admins only; save_company_profile enforces it. */
export async function saveCompanyProfileService(params: { orgId: string; input: CompanyProfileInput }) {
    return saveCompanyProfile(params.orgId, params.input);
}

export async function getImprovementsRemainingService() {
    return getImprovementsRemaining();
}

/**
 * Improves one field with the `rewrite` model. The claim comes first, so the
 * daily limit holds under parallel clicks; a failed call gives it back.
 */
export async function improveProfileFieldService({ field, orgId, profile }: ImproveProfileFieldInput) {
    if (!canImproveField(field, profile)) {
        throw new UserFacingError("Escriba algo en el campo antes de mejorarlo.");
    }

    const model = modelForRole("rewrite");
    const { eventId, remaining } = await claimProfileImprovement({ field, model, orgId });

    try {
        const { value, usage } = await improveField(field, profile, model);
        if (value.length === 0) {
            throw new Error("The model returned an empty field");
        }
        await finishProfileImprovement({ eventId, succeeded: true, ...usage });
        return { value, remaining };
    } catch (error) {
        await finishProfileImprovement({ eventId, succeeded: false, error: error instanceof Error ? error.message : String(error) });
        throw error;
    }
}
