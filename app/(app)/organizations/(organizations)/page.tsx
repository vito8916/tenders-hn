import { Suspense } from "react";
import { getCurrentUserWithProfile } from "@/lib/auth/get-current-user";
import { listOrganizationsByUserService } from "@/features/organizations/services";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Users, ChevronRight, Building2 } from "lucide-react";
import Link from "next/link";
import { OrgSearch } from "@/features/organizations/components/org-search";
import OrganizationAvatar from "@/features/organizations/components/organization-avatar";
import {
    Empty,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    EmptyDescription,
    EmptyContent,
} from "@/components/ui/empty";
import { OrganizationsListSkeleton } from "@/components/shared/organizations-list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

async function OrganizationsList({
    searchParams,
}: {
    searchParams: Promise<{ search?: string }>;
}) {
    const { user, profile } = await getCurrentUserWithProfile();

    if (!profile.onboardingCompletedAt) {
        redirect("/onboarding");
    }

    const organizations = await listOrganizationsByUserService({ userId: user.sub });
    const { search } = await searchParams;
    const searchTerm = search?.toLowerCase() || "";

    const filteredOrgs = organizations.filter(
        (org) =>
            org.name.toLowerCase().includes(searchTerm) ||
            org.slug.toLowerCase().includes(searchTerm)
    );

    const hasOrganizations = organizations.length > 0;
    const hasSearchResults = filteredOrgs.length > 0;

    return (
        <div className="w-full flex flex-col gap-3">
            {hasSearchResults &&
                filteredOrgs.map((org) => (
                    <Link
                        key={org.id}
                        href={`/organizations/${org.slug}`}
                        className="group block"
                    >
                        <div className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50">
                            <div className="flex items-center gap-4">
                                <OrganizationAvatar
                                    src={org.orgLogoUrl}
                                    name={org.name}
                                    className="h-10 w-10"
                                />
                                <div className="flex flex-col">
                                    <span className="font-medium text-foreground">{org.name}</span>
                                    <span className="text-sm text-muted-foreground">
                                        /organizations/{org.slug}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <Users className="h-4 w-4" />
                                    <span className="text-sm">{org.memberCount ?? 0}</span>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                            </div>
                        </div>
                    </Link>
                ))}

            {!hasSearchResults && hasOrganizations && (
                <Empty className="border">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Building2 />
                        </EmptyMedia>
                        <EmptyTitle>No matches found</EmptyTitle>
                        <EmptyDescription>
                            No organizations match your search. Try a different term or clear your
                            search.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}

            {!hasOrganizations && (
                <Empty className="border">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Building2 />
                        </EmptyMedia>
                        <EmptyTitle>No organizations yet</EmptyTitle>
                        <EmptyDescription>
                            Create your first organization to start collaborating with your team.
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button asChild>
                            <Link href="/organizations/create">
                                <Plus className="mr-2 h-4 w-4" />
                                Create organization
                            </Link>
                        </Button>
                    </EmptyContent>
                </Empty>
            )}
        </div>
    );
}

export default function OrganizationsPage({
    searchParams,
}: {
    searchParams: Promise<{ search?: string }>;
}) {
    return (
        <div className="flex w-full max-w-2xl flex-col items-center">
            <h1 className="mb-2 text-2xl font-bold">Organizations</h1>
            <p className="mb-8 text-center text-muted-foreground">
                Jump into an existing organization or add a new one.
            </p>

            <div className="mb-6 flex w-full items-center gap-4">
                <Suspense fallback={<Skeleton className="h-9 flex-1" />}>
                    <OrgSearch />
                </Suspense>
                <Button asChild>
                    <Link href="/organizations/create">
                        <Plus className="mr-2 h-4 w-4" />
                        Add organization
                    </Link>
                </Button>
            </div>

            <Suspense fallback={<OrganizationsListSkeleton />}>
                <OrganizationsList searchParams={searchParams} />
            </Suspense>
        </div>
    );
}
