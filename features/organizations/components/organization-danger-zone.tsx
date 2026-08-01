"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { deleteOrganizationAction } from "../actions";
import { leaveOrganizationAction } from "@/features/memberships/actions";

interface OrganizationDangerZoneProps {
    orgId: string;
    orgName: string;
    isOwner: boolean;
}

export function OrganizationDangerZone({ orgId, orgName, isOwner }: OrganizationDangerZoneProps) {
    const [confirmation, setConfirmation] = useState("");
    const [isPending, startTransition] = useTransition();

    function handleDelete() {
        startTransition(async () => {
            try {
                // Redirects to /organizations on success
                await deleteOrganizationAction(orgId);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to delete organization");
            }
        });
    }

    function handleLeave() {
        startTransition(async () => {
            const result = await leaveOrganizationAction({ orgId });
            if (result?.error) {
                toast.error(result.error);
            }
        });
    }

    return (
        <section className="rounded-lg border border-destructive/40 p-6">
            <h2 className="text-lg font-medium">Danger zone</h2>
            {isOwner ? (
                <>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Deleting the organization permanently removes all of its projects,
                        members, and invitations. This cannot be undone.
                    </p>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="mt-4" disabled={isPending}>
                                Delete organization
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete {orgName}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Type <strong>{orgName}</strong> to confirm. All data belonging
                                    to this organization will be permanently deleted.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <Input
                                value={confirmation}
                                onChange={(event) => setConfirmation(event.target.value)}
                                placeholder={orgName}
                            />
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setConfirmation("")}>
                                    Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    disabled={confirmation !== orgName || isPending}
                                    onClick={handleDelete}
                                >
                                    Delete permanently
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            ) : (
                <>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Leaving removes your access to this organization. An owner or admin
                        will have to invite you again.
                    </p>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="mt-4" disabled={isPending}>
                                Leave organization
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Leave {orgName}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    You will lose access to this organization and its projects.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction disabled={isPending} onClick={handleLeave}>
                                    Leave
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            )}
        </section>
    );
}
