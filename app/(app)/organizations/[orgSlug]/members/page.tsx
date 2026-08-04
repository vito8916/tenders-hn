import { Suspense } from "react";
import { Users } from "lucide-react";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { MembersPageSkeleton } from "@/components/shared/members-page-skeleton";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrganizationBySlugService } from "@/features/organizations/services";
import {
    getUserOrgRoleService,
    listOrgMembersService,
} from "@/features/memberships/services";
import { listPendingInvitationsService } from "@/features/invitations/services";
import {
    canChangeMemberRole,
    canRemoveMembers,
    canInviteMembers,
    canManageMembers,
    canTransferOwnership,
} from "@/features/organizations/rbac";
import { MembersTable } from "@/features/memberships/components/members-table";
import { PendingInvitationsTable } from "@/features/invitations/components/pending-invitations-table";
import { InviteMembersDialog } from "@/features/invitations/components/invite-members-dialog";

async function InviteMembersAction({
    params,
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    const { orgSlug } = await params;
    const [{ sub: userId }, organization] = await Promise.all([
        getCurrentUser(),
        getOrganizationBySlugService(orgSlug),
    ]);

    if (!organization) {
        return null;
    }

    const role = await getUserOrgRoleService({ userId, orgId: organization.id });
    if (!role || !canInviteMembers(role)) {
        return null;
    }

    return <InviteMembersDialog orgId={organization.id} orgSlug={orgSlug} />;
}

async function MembersContent({
    params,
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    const { orgSlug } = await params;
    const [{ sub: userId }, organization] = await Promise.all([
        getCurrentUser(),
        getOrganizationBySlugService(orgSlug),
    ]);

    if (!organization) {
        redirect("/organizations");
    }

    const role = await getUserOrgRoleService({ userId, orgId: organization.id });
    if (!role) {
        redirect("/organizations");
    }

    const showInvitations = canManageMembers(role);
    const [members, pendingInvitations] = await Promise.all([
        listOrgMembersService({ orgId: organization.id, userId }),
        showInvitations
            ? listPendingInvitationsService({ orgId: organization.id, userId })
            : Promise.resolve([]),
    ]);

    return (
        <>
            <MembersTable
                members={members}
                orgId={organization.id}
                orgSlug={orgSlug}
                currentUserId={userId}
                canChangeRoles={canChangeMemberRole(role)}
                canRemoveMembers={canRemoveMembers(role)}
                canTransferOwnership={canTransferOwnership(role)}
            />

            {showInvitations ? (
                <section className="space-y-3">
                    <h2 className="text-lg font-medium">Pending invitations</h2>
                    <PendingInvitationsTable
                        invitations={pendingInvitations}
                        orgId={organization.id}
                        orgSlug={orgSlug}
                    />
                </section>
            ) : null}
        </>
    );
}

export default function MembersPage({
    params,
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    return (
        <div className="flex flex-1 flex-col gap-6 p-4 px-4 lg:p-6 lg:px-8">
            <PageHeader
                icon={Users}
                title="Members"
                description="Manage who has access to this organization."
                action={
                    <Suspense fallback={<Skeleton className="h-9 w-36" />}>
                        <InviteMembersAction params={params} />
                    </Suspense>
                }
            />
            <Suspense fallback={<MembersPageSkeleton />}>
                <MembersContent params={params} />
            </Suspense>
        </div>
    );
}
