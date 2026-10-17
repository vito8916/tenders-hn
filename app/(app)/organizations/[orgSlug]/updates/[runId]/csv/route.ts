import type { NextRequest } from "next/server";
import { viewCsvResponse } from "@/features/search-runs/csv-response";

/** An update's frozen results, discarded ones and closed processes included. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ orgSlug: string; runId: string }> }) {
    const { orgSlug, runId } = await params;
    return viewCsvResponse(request, orgSlug, { kind: "update", runId });
}
