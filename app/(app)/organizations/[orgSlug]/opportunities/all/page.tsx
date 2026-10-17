import { OpportunitiesPage } from "@/features/search-runs/components/opportunities-page";
import type { SearchParamsRecord } from "@/features/search-runs/results";

export const metadata = { title: "Todas" };

export default function TodasPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: Promise<SearchParamsRecord> }) {
    return <OpportunitiesPage kind="todas" params={params} searchParams={searchParams} />;
}
