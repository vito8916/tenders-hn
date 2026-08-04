import { Suspense } from "react";
import { Users } from "lucide-react";
import { redirect } from "next/navigation";
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
import { PageSectionSkeleton } from "@/components/shared/page-section-skeleton";

async function MembersContent({ params }: { params: Promise<{ orgSlug: string }> }) {
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
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
                        <Users className="size-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold">Members</h1>
                        <p className="text-sm text-muted-foreground">
                            Manage who has access to this organization.
                        </p>
                    </div>
                </div>
                {canInviteMembers(role) ? (
                    <InviteMembersDialog orgId={organization.id} orgSlug={orgSlug} />
                ) : null}
            </div>

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

export default function MembersPage({ params }: { params: Promise<{ orgSlug: string }> }) {
    return (
        <div className="flex flex-1 flex-col gap-6 p-4 px-4 lg:p-6 lg:px-8">
            <Suspense fallback={<PageSectionSkeleton cards={0} />}>
                <MembersContent params={params} />
            </Suspense>
        </div>
    );
}
