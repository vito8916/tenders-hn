import { OpportunitiesPage } from "@/features/search-runs/components/opportunities-page";
import type { SearchParamsRecord } from "@/features/search-runs/results";

export const metadata = { title: "Recomendadas" };

export default function RecommendedPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: Promise<SearchParamsRecord> }) {
    return <OpportunitiesPage kind="recomendadas" params={params} searchParams={searchParams} />;
}
