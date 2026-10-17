import { redirect } from "next/navigation";
import { withParams, type SearchParamsRecord } from "@/features/search-runs/results";

/**
 * The organization's Home opens Recomendadas. Report emails and notifications sent before D7 link here with
 * ?busqueda=<search>[&ejecucion=<run>]: they open that update or that list, keeping the rest of the query.
 */
export default async function HomePage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: Promise<SearchParamsRecord> }) {
    const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
    const orgHref = `/organizations/${orgSlug}`;
    const rest = withParams(query, { busqueda: null, ejecucion: null });
    const kept = rest === "?" ? "" : rest;

    if (typeof query.ejecucion === "string") redirect(`${orgHref}/updates/${query.ejecucion}${kept}`);
    if (typeof query.busqueda === "string") redirect(`${orgHref}/lists/${query.busqueda}${kept}`);
    redirect(`${orgHref}/opportunities/recommended${kept}`);
}
