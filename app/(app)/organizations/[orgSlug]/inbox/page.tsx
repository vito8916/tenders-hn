import { Suspense } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { canUseInternalInbox, getInboxService } from "@/features/search-runs/services";
import { CompanyProfileSummary } from "@/features/company-profile/components/company-profile-summary";
import { RunSearchButton } from "@/features/search-runs/components/run-search-button";
import { RunStatus } from "@/features/search-runs/components/run-status";
import { MatchList } from "@/features/search-runs/components/match-list";

async function InboxContent({ params }: { params: Promise<{ orgSlug: string }> }) {
    const { orgSlug } = await params;
    const [{ sub: userId }, organization] = await Promise.all([getCurrentUser(), getOrganizationBySlugService(orgSlug)]);

    if (!organization) {
        redirect("/organizations");
    }

    const role = await getUserOrgRoleService({ userId, orgId: organization.id });
    if (!role || !canUseInternalInbox(role)) {
        notFound();
    }

    const { profile, run, matches } = await getInboxService(organization.id);
    const runActive = run?.status === "queued" || run?.status === "running";
    const profileSettingsHref = `/organizations/${orgSlug}/settings/company`;

    return (
        <>
            <section className="max-w-3xl space-y-4">
                {profile ? (
                    <>
                        <CompanyProfileSummary profile={profile} />
                        <div className="flex items-center gap-3">
                            <RunSearchButton orgId={organization.id} orgSlug={orgSlug} runActive={runActive} />
                            <Link href={profileSettingsHref} className="text-sm text-primary hover:underline">
                                Editar el perfil
                            </Link>
                            {runActive ? <span className="text-sm text-muted-foreground">Hay una búsqueda en curso.</span> : null}
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        La organización todavía no tiene un perfil.{" "}
                        <Link href={profileSettingsHref} className="text-primary hover:underline">
                            Defínalo en Configuración
                        </Link>{" "}
                        para ejecutar una búsqueda.
                    </p>
                )}
            </section>
            {run ? <RunStatus run={run} /> : null}
            {matches.length > 0 ? <MatchList matches={matches} /> : null}
        </>
    );
}

export default function InboxPage({ params }: { params: Promise<{ orgSlug: string }> }) {
    return (
        <div className="flex flex-1 flex-col gap-6 p-4 px-4 lg:p-6 lg:px-8">
            <PageHeader
                icon={Inbox}
                title="Bandeja interna"
                description="Oportunidades abiertas para el perfil de esta organización, evaluadas con Jev. Solo para revisión interna."
            />
            <Suspense fallback={<Skeleton className="h-64 w-full max-w-3xl" />}>
                <InboxContent params={params} />
            </Suspense>
        </div>
    );
}
