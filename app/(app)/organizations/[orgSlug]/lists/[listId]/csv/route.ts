import type { NextRequest } from "next/server";
import { viewCsvResponse } from "@/features/search-runs/csv-response";

/** A list's opportunities; the default search's list is Recomendadas, whose page (the Home) has no path of its own. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ orgSlug: string; listId: string }> }) {
    const { orgSlug, listId } = await params;
    return viewCsvResponse(request, orgSlug, { kind: "lista", searchId: listId });
}
