import "server-only";
import type { OrgRole } from "@/features/memberships/schemas";
import { getCompanyProfileService } from "@/features/company-profile/services";
import { getLatestSearchRun, listSearchRunMatches, requestSearchRun } from "./repository";

/** The internal inbox (plan, Phase 3) is for the owner, behind INTERNAL_INBOX=true, until the customer UI exists. */
export function canUseInternalInbox(role: OrgRole) {
    return role === "owner" && process.env.INTERNAL_INBOX === "true";
}

export async function getInboxService(orgId: string) {
    const [profile, run] = await Promise.all([getCompanyProfileService(orgId), getLatestSearchRun(orgId)]);
    const matches = run ? await listSearchRunMatches(run.id) : [];
    return { profile, run, matches };
}

const REQUEST_ERRORS: Record<string, string> = {
    not_owner: "Solo el propietario de la organización puede ejecutar búsquedas.",
    no_profile: "Guarde primero el perfil de la empresa.",
    run_in_progress: "Ya hay una búsqueda en curso. Espere a que termine.",
};

export async function requestSearchRunService(orgId: string) {
    try {
        return await requestSearchRun(orgId);
    } catch (error) {
        // The RPC raises its error codes as the Postgres error message.
        const code = typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
        throw new Error(REQUEST_ERRORS[code] ?? "No se pudo iniciar la búsqueda.");
    }
}
