"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckoutEventNames, initializePaddle, type Environments, type Paddle } from "@paddle/paddle-js";
import { Check } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { changePlanAction, prepareCheckoutAction, previewPlanChangeAction } from "../actions";
import type { PlanChangePreview, PlanOption } from "../schemas";
import { formatMoney } from "./format-money";

type PlanWithPrice = PlanOption & { price: { amount: string; currencyCode: string } | null };

/** Paddle.js, loaded once for this page; checkout.completed sends the page to «Activando su plan…» until the webhook arrives. */
function usePaddle() {
    const router = useRouter();
    const [paddle, setPaddle] = useState<Paddle | null>(null);

    useEffect(() => {
        const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
        if (!token) return;
        initializePaddle({
            token,
            environment: (process.env.NEXT_PUBLIC_PADDLE_ENV ?? "sandbox") as Environments,
            checkout: { settings: { locale: "es", variant: "one-page", showAddDiscounts: true, allowLogout: false } },
            eventCallback: (event) => {
                if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED) {
                    router.replace("?activando=1");
                } else if (event.name === CheckoutEventNames.CHECKOUT_ERROR) {
                    toast.error("No se pudo abrir el pago. Intente de nuevo en unos minutos.");
                }
            },
        }).then((instance) => instance && setPaddle(instance));
    }, [router]);

    return paddle;
}

function PlanFeatures({ plan }: { plan: PlanOption }) {
    const features = [
        plan.maxActiveSearches === null ? "Búsquedas ilimitadas" : `${plan.maxActiveSearches} búsquedas activas`,
        plan.maxMembers === null ? "Usuarios ilimitados" : `${plan.maxMembers} usuarios`,
        plan.historyMonths === null ? "Historial completo" : `${plan.historyMonths} meses de historial`,
        `${plan.monthlyAiCredits} créditos de IA al mes`,
    ];
    return (
        <ul className="space-y-1.5 text-sm">
            {features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                    <Check className="size-4 text-muted-foreground" />
                    {feature}
                </li>
            ))}
        </ul>
    );
}

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
    const paddle = usePaddle();
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
            <div className="grid gap-4 md:grid-cols-3">
                {plans.map((plan) => {
                    const isCurrent = plan.priceId === currentPriceId && hasLiveSubscription;
                    return (
                        <div key={plan.planId} className={cn("flex flex-col gap-4 rounded-lg border p-5", isCurrent && "border-primary")}>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="font-semibold">{plan.name}</h3>
                                    {isCurrent ? <Badge>Plan actual</Badge> : null}
                                </div>
                                <p className="text-2xl font-semibold tracking-tight">
                                    {plan.price ? formatMoney(plan.price.amount, plan.price.currencyCode) : "—"}
                                    <span className="text-sm font-normal text-muted-foreground"> al mes</span>
                                </p>
                                <p className="text-xs text-muted-foreground">Impuestos incluidos</p>
                                {plan.description ? <p className="text-sm text-muted-foreground">{plan.description}</p> : null}
                            </div>
                            <PlanFeatures plan={plan} />
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
                        </div>
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
