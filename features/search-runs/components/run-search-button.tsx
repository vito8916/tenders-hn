"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { requestSearchRunAction } from "../actions";

export function RunSearchButton({ orgId, orgSlug, runActive }: { orgId: string; orgSlug: string; runActive: boolean }) {
    const [isPending, startTransition] = useTransition();

    const run = () =>
        startTransition(async () => {
            const result = await requestSearchRunAction({ orgId, orgSlug });
            if (result.success) {
                toast.success("Búsqueda iniciada");
            } else {
                toast.error(result.error ?? "No se pudo iniciar la búsqueda.");
            }
        });

    return (
        <Button onClick={run} disabled={isPending || runActive}>
            {isPending ? "Iniciando…" : "Ejecutar ahora"}
        </Button>
    );
}
