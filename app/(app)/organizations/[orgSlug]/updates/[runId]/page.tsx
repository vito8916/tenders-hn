import { OpportunitiesPage } from "@/features/search-runs/components/opportunities-page";
import type { SearchParamsRecord } from "@/features/search-runs/results";

export const metadata = { title: "Actualización" };

export default function UpdatePage({ params, searchParams }: { params: Promise<{ orgSlug: string; runId: string }>; searchParams: Promise<SearchParamsRecord> }) {
    return <OpportunitiesPage kind="update" params={params} searchParams={searchParams} />;
}
