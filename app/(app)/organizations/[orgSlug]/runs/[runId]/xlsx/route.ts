import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { getRunExcelUrlService } from "@/features/search-runs/services";

/** The run's Excel file: a redirect to a link valid for a minute. */
export async function GET(_request: Request, { params }: { params: Promise<{ orgSlug: string; runId: string }> }) {
    const { orgSlug, runId } = await params;
    const [{ sub: userId }, organization] = await Promise.all([getCurrentUser(), getOrganizationBySlugService(orgSlug)]);
    const role = organization ? await getUserOrgRoleService({ userId, orgId: organization.id }) : null;
    const url = organization && role ? await getRunExcelUrlService({ orgId: organization.id, runId }) : null;
    if (!url) {
        return new Response("El Excel de esta ejecución no está disponible.", { status: 404 });
    }
    redirect(url);
}
