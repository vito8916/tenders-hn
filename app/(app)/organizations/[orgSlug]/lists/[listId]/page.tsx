import { OpportunitiesPage } from "@/features/search-runs/components/opportunities-page";
import type { SearchParamsRecord } from "@/features/search-runs/results";

export const metadata = { title: "Lista" };

export default function ListPage({ params, searchParams }: { params: Promise<{ orgSlug: string; listId: string }>; searchParams: Promise<SearchParamsRecord> }) {
    return <OpportunitiesPage kind="lista" params={params} searchParams={searchParams} />;
}
