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
			const result = await deleteOrganizationAction(orgId);
			if (result?.error) {
				toast.error(result.error);
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
			title="Zona de riesgo"
			description={
				isOwner
					? "Acciones irreversibles que afectan a esta organización y a todos sus datos."
					: "Acciones que eliminan su acceso a esta organización."
			}
		>
			<SettingsSectionBody className="py-0">
				<SettingsRow
					label={isOwner ? "Eliminar la organización" : "Salir de la organización"}
					description={
						isOwner
							? "Elimina de forma permanente los miembros, las invitaciones y los datos de la organización."
							: "Perderá el acceso hasta que un administrador lo vuelva a invitar."
					}
				>
					{isOwner ? (
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button variant="destructive" size="sm" disabled={isPending}>
									Eliminar
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>¿Eliminar {orgName}?</AlertDialogTitle>
									<AlertDialogDescription>
										Escriba <strong>{orgName}</strong> para confirmar. Todos los datos
										de esta organización se eliminarán de forma permanente.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<Input
									value={confirmation}
									onChange={(event) => setConfirmation(event.target.value)}
									placeholder={orgName}
								/>
								<AlertDialogFooter>
									<AlertDialogCancel onClick={() => setConfirmation("")}>
										Cancelar
									</AlertDialogCancel>
									<AlertDialogAction
										disabled={confirmation !== orgName || isPending}
										onClick={handleDelete}
									>
										Eliminar de forma permanente
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					) : (
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button variant="destructive" size="sm" disabled={isPending}>
									Salir
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>¿Salir de {orgName}?</AlertDialogTitle>
									<AlertDialogDescription>
										Perderá el acceso a esta organización y a sus datos.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancelar</AlertDialogCancel>
									<AlertDialogAction disabled={isPending} onClick={handleLeave}>
										Salir
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
