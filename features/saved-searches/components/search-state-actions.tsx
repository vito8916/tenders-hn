"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { deleteSavedSearchAction, setSavedSearchActiveAction } from "../actions";

/** Pause or resume a search, and delete it with its history. */
export function SearchStateActions({
    orgId,
    orgSlug,
    searchId,
    searchName,
    isActive,
}: {
    orgId: string;
    orgSlug: string;
    searchId: string;
    searchName: string;
    isActive: boolean;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const toggleActive = () =>
        startTransition(async () => {
            const result = await setSavedSearchActiveAction({ orgId, orgSlug, searchId, isActive: !isActive });
            if (result.success) {
                toast.success(isActive ? "Se pausó la búsqueda." : "Se reactivó la búsqueda.");
            } else {
                toast.error(result.error ?? "No se pudo cambiar el estado de la búsqueda.");
            }
        });

    const remove = () =>
        startTransition(async () => {
            const result = await deleteSavedSearchAction({ orgId, orgSlug, searchId });
            if (result.success) {
                toast.success("Se eliminó la búsqueda.");
                router.push(`/organizations/${orgSlug}/searches`);
            } else {
                toast.error(result.error ?? "No se pudo eliminar la búsqueda.");
            }
        });

    return (
        <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={isPending} onClick={toggleActive}>
                {isActive ? "Pausar" : "Reactivar"}
            </Button>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isPending}>
                        Eliminar
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar «{searchName}»?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminan también todas sus ejecuciones y resultados. Si solo quiere detenerla, páusela.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction disabled={isPending} onClick={remove}>
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
