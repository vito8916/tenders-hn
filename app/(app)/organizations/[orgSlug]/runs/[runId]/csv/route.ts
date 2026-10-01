import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { matchesToCsv } from "@/features/search-runs/csv";
import { applyResultView, parseResultView, type SearchParamsRecord } from "@/features/search-runs/results";
import { getRunExportService, runFileName } from "@/features/search-runs/services";

/**
 * A run's results as CSV (spec §12.2), with the user's session: every
 * result of the run (?alcance=todos, all pages), or only those matching the
 * table's filters (?alcance=filtrados plus the same parameters as the Home).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ orgSlug: string; runId: string }> }) {
    const { orgSlug, runId } = await params;
    const [{ sub: userId }, organization] = await Promise.all([getCurrentUser(), getOrganizationBySlugService(orgSlug)]);
    const role = organization ? await getUserOrgRoleService({ userId, orgId: organization.id }) : null;
    const exported = organization && role ? await getRunExportService({ orgId: organization.id, runId }) : null;
    if (!exported) {
        return new Response("No se encontró la ejecución.", { status: 404 });
    }

    const query: SearchParamsRecord = {};
    for (const key of new Set(request.nextUrl.searchParams.keys())) query[key] = request.nextUrl.searchParams.getAll(key);
    const onlyFiltered = query.alcance?.[0] === "filtrados";
    const view = parseResultView(onlyFiltered ? query : { orden: query.orden });
    const { filtered } = applyResultView(exported.matches, view);

    const fileName = `${runFileName(exported.searchName, exported.run.createdAt)}${onlyFiltered ? "-filtrados" : ""}.csv`;
    return new Response(matchesToCsv(filtered), {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Cache-Control": "private, no-store",
        },
    });
}
