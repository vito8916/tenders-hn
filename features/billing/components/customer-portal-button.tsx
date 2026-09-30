"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getCustomerPortalUrlAction } from "../actions";

/** Opens Paddle's customer portal, where the owner updates the card, downloads invoices, or cancels. */
export function CustomerPortalButton({ orgId, children }: { orgId: string; children: React.ReactNode }) {
    const [isPending, startTransition] = useTransition();

    const open = () =>
        startTransition(async () => {
            const result = await getCustomerPortalUrlAction({ orgId });
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            window.location.assign(result.data);
        });

    return (
        <Button variant="outline" size="sm" disabled={isPending} onClick={open}>
            {isPending ? "Abriendo…" : children}
        </Button>
    );
}
