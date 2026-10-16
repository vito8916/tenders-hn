"use client";

import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { RefreshWhileActive } from "@/components/shared/refresh-while-active";

/**
 * Shows the plan gate instead of the page when the organization has no active plan (gate is null when it has one).
 * Facturación stays reachable, since that is where the plan is chosen and paid. After checkout, the plan arrives by
 * webhook: the page reloads on its own until it does.
 */
export function PlanGateBoundary({ gate, children }: { gate: ReactNode; children: ReactNode }) {
    const pathname = usePathname();
    const activating = useSearchParams().has("activando");

    if (!gate || pathname.endsWith("/settings/billing")) return children;

    if (activating) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Activando su plan… La página se actualiza sola en unos segundos.</p>
                <RefreshWhileActive />
            </div>
        );
    }

    return gate;
}
