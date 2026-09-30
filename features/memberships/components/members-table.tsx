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
import { ROLE_LABELS, type OrgMember } from "../schemas";
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
                toast.success("Se actualizó el rol.");
            } else {
                toast.error(result.error ?? "No se pudo cambiar el rol.");
            }
        });
    }

    function handleRemove(membershipId: string) {
        startTransition(async () => {
            const result = await removeMemberAction({ orgId, orgSlug, membershipId });
            if (result.success) {
                toast.success("Se quitó al miembro.");
            } else {
                toast.error(result.error ?? "No se pudo quitar al miembro.");
            }
        });
    }

    function handleTransferOwnership(newOwnerUserId: string) {
        startTransition(async () => {
            const result = await transferOwnershipAction({ orgId, orgSlug, newOwnerUserId });
            if (result.success) {
                toast.success("Se transfirió la propiedad.");
            } else {
                toast.error(result.error ?? "No se pudo transferir la propiedad.");
            }
        });
    }

    return (
        <div className="rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Miembro</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Miembro desde</TableHead>
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
                                                {member.fullName ?? "Usuario sin nombre"}
                                                {isSelf ? (
                                                    <span className="ml-1 text-muted-foreground">(usted)</span>
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
                                                <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
                                                <SelectItem value="member">{ROLE_LABELS.member}</SelectItem>
                                                <SelectItem value="viewer">{ROLE_LABELS.viewer}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Badge variant={isOwner ? "default" : "secondary"}>
                                            {ROLE_LABELS[member.role]}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {member.createdAt.toLocaleDateString("es-HN")}
                                </TableCell>
                                <TableCell>
                                    {showTransfer ? (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" disabled={isPending}>
                                                    <Crown className="size-4" />
                                                    <span className="sr-only">Transferir la propiedad</span>
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>¿Transferir la propiedad?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        {member.fullName ?? member.email} será el nuevo propietario de
                                                        esta organización y usted pasará a ser administrador. Solo el
                                                        nuevo propietario podrá revertir este cambio.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleTransferOwnership(member.userId)}>
                                                        Transferir
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
                                                    <span className="sr-only">Quitar miembro</span>
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>¿Quitar a este miembro?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        {member.fullName ?? member.email} perderá el acceso a esta
                                                        organización y a todos sus datos.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleRemove(member.id)}>
                                                        Quitar
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
