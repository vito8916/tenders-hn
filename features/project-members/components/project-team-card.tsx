"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserPlus, Trash2 } from "lucide-react";
import type { OrgMember } from "@/features/memberships/schemas";
import type { ProjectMemberWithProfile } from "../schemas";
import { assignProjectMemberAction, unassignProjectMemberAction } from "../actions";

interface ProjectTeamCardProps {
    members: ProjectMemberWithProfile[];
    assignableMembers: OrgMember[];
    canManage: boolean;
    projectOwnerId: string;
    orgId: string;
    orgSlug: string;
    projectId: string;
    projectSlug: string;
}

function memberInitials(member: { fullName: string | null; email: string | null }): string {
    const source = member.fullName ?? member.email ?? "?";
    return source
        .split(" ")
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

export function ProjectTeamCard({
    members,
    assignableMembers,
    canManage,
    projectOwnerId,
    orgId,
    orgSlug,
    projectId,
    projectSlug,
}: ProjectTeamCardProps) {
    const [isPending, startTransition] = useTransition();
    const [popoverOpen, setPopoverOpen] = useState(false);

    function handleAssign(targetUserId: string) {
        setPopoverOpen(false);
        startTransition(async () => {
            const result = await assignProjectMemberAction({
                orgId,
                orgSlug,
                projectId,
                projectSlug,
                targetUserId,
            });
            if (result.success) {
                toast.success("Member added to project");
            } else {
                toast.error(result.error ?? "Failed to add member");
            }
        });
    }

    function handleUnassign(targetUserId: string) {
        startTransition(async () => {
            const result = await unassignProjectMemberAction({
                orgId,
                orgSlug,
                projectId,
                projectSlug,
                targetUserId,
            });
            if (result.success) {
                toast.success("Member removed from project");
            } else {
                toast.error(result.error ?? "Failed to remove member");
            }
        });
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Team</CardTitle>
                {canManage ? (
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" disabled={isPending}>
                                <UserPlus className="size-4" />
                                Add member
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="end">
                            <Command>
                                <CommandInput placeholder="Search members..." />
                                <CommandList>
                                    <CommandEmpty>No members to add.</CommandEmpty>
                                    <CommandGroup>
                                        {assignableMembers.map((member) => (
                                            <CommandItem
                                                key={member.userId}
                                                value={member.fullName ?? member.email ?? member.userId}
                                                onSelect={() => handleAssign(member.userId)}
                                            >
                                                {member.fullName ?? member.email ?? "Unnamed user"}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
                {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No members assigned to this project.</p>
                ) : (
                    members.map((member) => {
                        const showRemove = canManage && member.userId !== projectOwnerId;

                        return (
                            <div key={member.id} className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <Avatar className="size-8">
                                        <AvatarImage src={member.avatarUrl ?? undefined} alt="" />
                                        <AvatarFallback>{memberInitials(member)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-medium">
                                            {member.fullName ?? "Unnamed user"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{member.email}</p>
                                    </div>
                                    <Badge variant="secondary" className="capitalize">
                                        {member.orgRole}
                                    </Badge>
                                </div>
                                {showRemove ? (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={isPending}
                                        onClick={() => handleUnassign(member.userId)}
                                    >
                                        <Trash2 className="size-4" />
                                        <span className="sr-only">Remove from project</span>
                                    </Button>
                                ) : null}
                            </div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}
