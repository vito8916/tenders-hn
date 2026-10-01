import { Suspense } from "react";
import { redirect } from "next/navigation";

async function RedirectToHome({ params }: { params: Promise<{ orgSlug: string; searchId: string }> }) {
    const { orgSlug, searchId } = await params;
    redirect(`/organizations/${orgSlug}?busqueda=${encodeURIComponent(searchId)}`);
    return null;
}

/** A search's results live in the Home now (spec §12.1); old links and notifications land there. */
export default function SearchPage({ params }: { params: Promise<{ orgSlug: string; searchId: string }> }) {
    return (
        <Suspense>
            <RedirectToHome params={params} />
        </Suspense>
    );
}
