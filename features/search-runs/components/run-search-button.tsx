"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { requestSearchRunAction } from "../actions";

export function RunSearchButton({
    searchId,
    orgSlug,
    disabled,
    size,
}: {
    searchId: string;
    orgSlug: string;
    disabled?: boolean;
    size?: "sm" | "default";
}) {
    const [isPending, startTransition] = useTransition();

    const run = () =>
        startTransition(async () => {
            const result = await requestSearchRunAction({ searchId, orgSlug });
            if (result.success) {
                toast.success("Actualización iniciada");
            } else {
                toast.error(result.error ?? "No se pudo iniciar la actualización.");
            }
        });

    return (
        <Button onClick={run} disabled={isPending || disabled} size={size}>
            {isPending ? "Iniciando…" : "Actualizar ahora"}
        </Button>
    );
}
