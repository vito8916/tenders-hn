"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Crown, Trash2 } from "lucide-react";
import type { OrgMember } from "../schemas";
import { changeMemberRoleAction, removeMemberAction } from "../actions";
import { transferOwnershipAction } from "@/features/organizations/actions";

interface MembersTableProps {
    members: OrgMember[];
    orgId: string;
    orgSlug: string;
    currentUserId: string;
    canChangeRoles: boolean;
    canRemoveMembers: boolean;
    canTransferOwnership: boolean;
}

function memberInitials(member: OrgMember): string {
    const source = member.fullName ?? member.email ?? "?";
    return source
        .split(" ")
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

export function MembersTable({
    members,
    orgId,
    orgSlug,
    currentUserId,
    canChangeRoles,
    canRemoveMembers,
    canTransferOwnership,
}: MembersTableProps) {
    const [isPending, startTransition] = useTransition();

    function handleRoleChange(membershipId: string, newRole: string) {
        startTransition(async () => {
            const result = await changeMemberRoleAction({ orgId, orgSlug, membershipId, newRole });
            if (result.success) {
                toast.success("Role updated");
            } else {
                toast.error(result.error ?? "Failed to change role");
            }
        });
    }

    function handleRemove(membershipId: string) {
        startTransition(async () => {
            const result = await removeMemberAction({ orgId, orgSlug, membershipId });
            if (result.success) {
                toast.success("Member removed");
            } else {
                toast.error(result.error ?? "Failed to remove member");
            }
        });
    }

    function handleTransferOwnership(newOwnerUserId: string) {
        startTransition(async () => {
            const result = await transferOwnershipAction({ orgId, orgSlug, newOwnerUserId });
            if (result.success) {
                toast.success("Ownership transferred");
            } else {
                toast.error(result.error ?? "Failed to transfer ownership");
            }
        });
    }

    return (
        <div className="rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="w-16" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {members.map((member) => {
                        const isSelf = member.userId === currentUserId;
                        const isOwner = member.role === "owner";
                        const showRoleSelect = canChangeRoles && !isOwner && !isSelf;
                        const showRemove = canRemoveMembers && !isOwner && !isSelf;
                        const showTransfer = canTransferOwnership && !isOwner && !isSelf;

                        return (
                            <TableRow key={member.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="size-8">
                                            <AvatarImage src={member.avatarUrl ?? undefined} alt="" />
                                            <AvatarFallback>{memberInitials(member)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-medium">
                                                {member.fullName ?? "Unnamed user"}
                                                {isSelf ? (
                                                    <span className="ml-1 text-muted-foreground">(you)</span>
                                                ) : null}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{member.email}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {showRoleSelect ? (
                                        <Select
                                            defaultValue={member.role}
                                            disabled={isPending}
                                            onValueChange={(value) => handleRoleChange(member.id, value)}
                                        >
                                            <SelectTrigger className="w-32" size="sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="admin">Admin</SelectItem>
                                                <SelectItem value="member">Member</SelectItem>
                                                <SelectItem value="viewer">Viewer</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Badge variant={isOwner ? "default" : "secondary"} className="capitalize">
                                            {member.role}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {member.createdAt.toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                    {showTransfer ? (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" disabled={isPending}>
                                                    <Crown className="size-4" />
                                                    <span className="sr-only">Transfer ownership</span>
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Transfer ownership</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        {member.fullName ?? member.email} will become the owner of
                                                        this organization and you will become an admin. This can
                                                        only be undone by the new owner.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleTransferOwnership(member.userId)}>
                                                        Transfer
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    ) : null}
                                    {showRemove ? (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" disabled={isPending}>
                                                    <Trash2 className="size-4" />
                                                    <span className="sr-only">Remove member</span>
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Remove member</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        {member.fullName ?? member.email} will lose access to this
                                                        organization and all of its projects.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleRemove(member.id)}>
                                                        Remove
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    ) : null}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
