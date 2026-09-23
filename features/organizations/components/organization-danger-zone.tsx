"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
	SettingsRow,
	SettingsSection,
	SettingsSectionBody,
} from "@/components/settings/settings-section";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteOrganizationAction } from "../actions";
import { leaveOrganizationAction } from "@/features/memberships/actions";

interface OrganizationDangerZoneProps {
	orgId: string;
	orgName: string;
	isOwner: boolean;
}

export function OrganizationDangerZone({
	orgId,
	orgName,
	isOwner,
}: OrganizationDangerZoneProps) {
	const [confirmation, setConfirmation] = useState("");
	const [isPending, startTransition] = useTransition();

	function handleDelete() {
		startTransition(async () => {
			try {
				await deleteOrganizationAction(orgId);
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: "Failed to delete organization"
				);
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
		<SettingsSection
			variant="danger"
			title="Danger zone"
			description={
				isOwner
					? "Irreversible actions that affect this organization and all its data."
					: "Actions that remove your access to this organization."
			}
		>
			<SettingsSectionBody className="py-0">
				<SettingsRow
					label={isOwner ? "Delete organization" : "Leave organization"}
					description={
						isOwner
							? "Permanently removes all members, invitations, and organization data."
							: "You will lose access until an admin invites you again."
					}
				>
					{isOwner ? (
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button variant="destructive" size="sm" disabled={isPending}>
									Delete
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Delete {orgName}</AlertDialogTitle>
									<AlertDialogDescription>
										Type <strong>{orgName}</strong> to confirm. All data
										belonging to this organization will be permanently deleted.
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
					) : (
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button variant="destructive" size="sm" disabled={isPending}>
									Leave
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Leave {orgName}</AlertDialogTitle>
									<AlertDialogDescription>
										You will lose access to this organization and its data.
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
					)}
				</SettingsRow>
			</SettingsSectionBody>
		</SettingsSection>
	);
}
