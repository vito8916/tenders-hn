"use client";

import { useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setListFollowedAction } from "../actions";

/** Follow or unfollow a list: who follows it receives its new opportunities in the report email (spec 0.4 §7). */
export function FollowListButton({
    orgId,
    orgSlug,
    searchId,
    followed,
}: {
    orgId: string;
    orgSlug: string;
    searchId: string;
    followed: boolean;
}) {
    const [isPending, startTransition] = useTransition();

    const toggle = () =>
        startTransition(async () => {
            const result = await setListFollowedAction({ orgId, orgSlug, searchId, followed: !followed });
            if (result.success) {
                toast.success(followed ? "Dejó de seguir la lista." : "Ahora sigue la lista: sus oportunidades nuevas llegarán en su correo de reporte.");
            } else {
                toast.error(result.error ?? "No se pudo cambiar el seguimiento de la lista.");
            }
        });

    return (
        <Button variant="outline" disabled={isPending} onClick={toggle} aria-pressed={followed}>
            {followed ? <BellOff /> : <Bell />}
            {followed ? "Dejar de seguir" : "Seguir"}
        </Button>
    );
}
