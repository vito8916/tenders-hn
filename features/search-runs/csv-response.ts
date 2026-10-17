import "server-only";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { matchesToCsv } from "./csv";
import type { HomeView } from "./opportunities";
import { applyResultView, parseResultView, type SearchParamsRecord } from "./results";
import { getHomeService, homeViewFileName, homeViewRows } from "./services";

/**
 * A view's opportunities as CSV (spec 0.4 §12.2), with the user's session: every row (?alcance=todos, all
 * pages) or only those matching the table's filters (?alcance=filtrados plus the same parameters as the page).
 */
export async function viewCsvResponse(request: NextRequest, orgSlug: string, view: HomeView) {
    const [{ sub: userId }, organization] = await Promise.all([getCurrentUser(), getOrganizationBySlugService(orgSlug)]);
    const role = organization ? await getUserOrgRoleService({ userId, orgId: organization.id }) : null;
    const home = organization && role ? await getHomeService({ orgId: organization.id, view }) : null;
    if (!home) {
        return new Response("No se encontraron las oportunidades.", { status: 404 });
    }

    const query: SearchParamsRecord = {};
    for (const key of new Set(request.nextUrl.searchParams.keys())) query[key] = request.nextUrl.searchParams.getAll(key);
    const onlyFiltered = query.alcance?.[0] === "filtrados";
    const { filtered } = applyResultView(homeViewRows(home), parseResultView(onlyFiltered ? query : { orden: query.orden }));

    return new Response(matchesToCsv(filtered), {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${homeViewFileName(home)}${onlyFiltered ? "-filtrados" : ""}.csv"`,
            "Cache-Control": "private, no-store",
        },
    });
}
