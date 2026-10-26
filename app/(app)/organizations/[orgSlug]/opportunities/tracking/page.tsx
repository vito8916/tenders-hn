import { OpportunitiesPage } from "@/features/search-runs/components/opportunities-page";
import type { SearchParamsRecord } from "@/features/search-runs/results";

export const metadata = { title: "En seguimiento" };

export default function SeguimientoPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: Promise<SearchParamsRecord> }) {
    return <OpportunitiesPage kind="seguimiento" params={params} searchParams={searchParams} />;
}
