"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requestSearchRunAction } from "../actions";

export function ProfileForm({
    orgId,
    orgSlug,
    defaultDescription,
    runActive,
}: {
    orgId: string;
    orgSlug: string;
    defaultDescription: string;
    runActive: boolean;
}) {
    const [description, setDescription] = useState(defaultDescription);
    const [isPending, startTransition] = useTransition();

    const submit = () =>
        startTransition(async () => {
            const result = await requestSearchRunAction({ orgId, orgSlug, description });
            if (result.success) {
                toast.success("Búsqueda iniciada");
            } else {
                toast.error(result.error ?? "No se pudo iniciar la búsqueda.");
            }
        });

    return (
        <form
            className="space-y-3"
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
        >
            <label htmlFor="company-description" className="text-sm font-medium">
                Objeto social o descripción de la empresa
            </label>
            <Textarea
                id="company-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={8}
                placeholder="Pegue el objeto social de la escritura de constitución o describa qué vende la empresa."
            />
            <div className="flex items-center gap-3">
                <Button type="submit" disabled={isPending || runActive || !description.trim()}>
                    {isPending ? "Iniciando…" : "Guardar y ejecutar"}
                </Button>
                {runActive ? <span className="text-sm text-muted-foreground">Hay una búsqueda en curso.</span> : null}
            </div>
        </form>
    );
}
