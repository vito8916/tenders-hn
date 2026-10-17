import type { NextRequest } from "next/server";
import { viewCsvResponse } from "@/features/search-runs/csv-response";

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
    const { orgSlug } = await params;
    return viewCsvResponse(request, orgSlug, { kind: "todas" });
}
