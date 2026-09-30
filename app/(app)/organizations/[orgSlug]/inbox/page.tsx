import { Suspense } from "react";
import { Inbox } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import { getUserOrgRoleService } from "@/features/memberships/services";
import { canUseInternalInbox, getInboxService } from "@/features/search-runs/services";
import { ProfileForm } from "@/features/search-runs/components/profile-form";
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

    return (
        <>
            <section className="max-w-3xl">
                <ProfileForm
                    // Remount with the saved text after a run starts.
                    key={profile?.version ?? 0}
                    orgId={organization.id}
                    orgSlug={orgSlug}
                    defaultDescription={profile?.description ?? ""}
                    runActive={runActive}
                />
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
