"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getPlanActiveAction } from "@/features/billing/actions";

const PLAN_POLL_MS = 3_000;

/** Paddle's webhook activates the plan a few seconds after checkout; the organization opens once it has. */
export function ActivationStep({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
    const router = useRouter();

    useEffect(() => {
        const interval = setInterval(async () => {
            const result = await getPlanActiveAction({ orgId });
            if (result.success && result.data) {
                clearInterval(interval);
                router.replace(`/organizations/${orgSlug}`);
            }
        }, PLAN_POLL_MS);
        return () => clearInterval(interval);
    }, [orgId, orgSlug, router]);

    return (
        <div className="flex w-full flex-col items-center gap-3 py-16 text-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <h2 className="text-2xl font-bold">Activando su plan</h2>
            <p className="text-muted-foreground">
                Ya recibimos su pago. En unos segundos abriremos su organización y empezaremos a preparar sus oportunidades.
            </p>
        </div>
    );
}
