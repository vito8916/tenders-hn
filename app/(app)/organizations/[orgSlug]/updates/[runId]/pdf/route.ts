import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { getRunReportUrlService } from "@/features/search-runs/services";

/** The run's frozen PDF (spec §7): a redirect to a link valid for a minute. */
export async function GET(_request: Request, { params }: { params: Promise<{ orgSlug: string; runId: string }> }) {
    const { orgSlug, runId } = await params;
    const [{ sub: userId }, organization] = await Promise.all([getCurrentUser(), getOrganizationBySlugService(orgSlug)]);
    const role = organization ? await getUserOrgRoleService({ userId, orgId: organization.id }) : null;
    const url = organization && role ? await getRunReportUrlService({ orgId: organization.id, runId }) : null;
    if (!url) {
        return new Response("El reporte de esta actualización no está disponible.", { status: 404 });
    }
    redirect(url);
}
