"use client";

import { useState, useTransition } from "react";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { changePlanAction, prepareCheckoutAction, previewPlanChangeAction } from "../actions";
import type { PlanChangePreview, PlanWithPrice } from "../schemas";
import { formatMoney } from "./format-money";
import { PlanCard } from "./plan-card";
import { usePaddle } from "./use-paddle";

/**
 * The plans for sale. Without a live subscription a plan opens Paddle's
 * checkout (pilots enter their discount code there); with one, it previews
 * the prorated difference and changes plan after confirming.
 */
export function PlanOptions({
    orgId,
    orgSlug,
    plans,
    currentPriceId,
    hasLiveSubscription,
    canManage,
}: {
    orgId: string;
    orgSlug: string;
    plans: PlanWithPrice[];
    currentPriceId: string | null;
    hasLiveSubscription: boolean;
    canManage: boolean;
}) {
    const router = useRouter();
    // The page shows «Actualizando su plan…» until the webhook arrives.
    const paddle = usePaddle(() => router.replace("?activando=1"));
    const [isPending, startTransition] = useTransition();
    const [pendingChange, setPendingChange] = useState<{ plan: PlanWithPrice; preview: PlanChangePreview | null } | null>(null);

    const subscribe = (plan: PlanWithPrice) =>
        startTransition(async () => {
            const result = await prepareCheckoutAction({ orgId, orgSlug, priceId: plan.priceId });
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            const { priceId, customData, customer } = result.data;
            paddle?.Checkout.open({ items: [{ priceId, quantity: 1 }], customData, ...(customer && { customer }) });
        });

    const previewChange = (plan: PlanWithPrice) =>
        startTransition(async () => {
            const result = await previewPlanChangeAction({ orgId, orgSlug, priceId: plan.priceId });
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            setPendingChange({ plan, preview: result.data });
        });

    const confirmChange = () =>
        startTransition(async () => {
            if (!pendingChange) return;
            const result = await changePlanAction({ orgId, orgSlug, priceId: pendingChange.plan.priceId });
            setPendingChange(null);
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            toast.success(`Se cambió al plan ${pendingChange.plan.name}.`);
            router.replace(`?cambio=${pendingChange.plan.priceId}`);
        });

    return (
        <>
            <div className="grid gap-4">
                {plans.map((plan) => {
                    const isCurrent = plan.priceId === currentPriceId && hasLiveSubscription;
                    return (
                        <PlanCard key={plan.planId} plan={plan} highlighted={isCurrent} badge={isCurrent ? <Badge>Plan actual</Badge> : null}>
                            {canManage && !isCurrent ? (
                                <Button
                                    className="mt-auto"
                                    variant={hasLiveSubscription ? "outline" : "default"}
                                    disabled={isPending || (!hasLiveSubscription && !paddle)}
                                    onClick={() => (hasLiveSubscription ? previewChange(plan) : subscribe(plan))}
                                >
                                    {hasLiveSubscription ? `Cambiar a ${plan.name}` : `Elegir ${plan.name}`}
                                </Button>
                            ) : null}
                        </PlanCard>
                    );
                })}
            </div>

            <AlertDialog open={pendingChange !== null} onOpenChange={(open) => !open && setPendingChange(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Cambiar al plan {pendingChange?.plan.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingChange?.preview
                                ? pendingChange.preview.action === "charge"
                                    ? `Se cobrará ahora ${formatMoney(pendingChange.preview.amount, pendingChange.preview.currencyCode)} por el resto del período. Después, el nuevo precio mensual.`
                                    : `Se abonarán ${formatMoney(pendingChange.preview.amount, pendingChange.preview.currencyCode)} a su próxima factura por el resto del período.`
                                : "El cambio se aplica ahora, con el precio proporcional al resto del período."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction disabled={isPending} onClick={confirmChange}>
                            Cambiar de plan
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
