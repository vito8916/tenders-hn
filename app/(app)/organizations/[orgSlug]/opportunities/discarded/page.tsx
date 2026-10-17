import { OpportunitiesPage } from "@/features/search-runs/components/opportunities-page";
import type { SearchParamsRecord } from "@/features/search-runs/results";

export const metadata = { title: "Descartadas" };

export default function DescartadasPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: Promise<SearchParamsRecord> }) {
    return <OpportunitiesPage kind="descartadas" params={params} searchParams={searchParams} />;
}
