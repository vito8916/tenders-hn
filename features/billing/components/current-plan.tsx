import { Badge } from "@/components/ui/badge";
import type { Subscription, SubscriptionStatus } from "../schemas";
import { CustomerPortalButton } from "./customer-portal-button";

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
    trialing: "Prueba",
    active: "Activo",
    past_due: "Pago pendiente",
    paused: "Pausado",
    canceled: "Cancelado",
    expired: "Vencido",
};

const date = new Intl.DateTimeFormat("es-HN", { dateStyle: "long", timeZone: "America/Tegucigalpa" });

// Must match the grace in private.active_plan_id (plan O11).
const PAST_DUE_GRACE_DAYS = 7;

function StatusLine({ subscription }: { subscription: Subscription }) {
    if (subscription.scheduledChange?.action === "cancel") {
        return <>Se cancelará el {date.format(new Date(subscription.scheduledChange.effective_at))}; hasta entonces sigue activo.</>;
    }
    if (subscription.status === "past_due" && subscription.pastDueSince) {
        const readOnlyFrom = new Date(new Date(subscription.pastDueSince).getTime() + PAST_DUE_GRACE_DAYS * 86_400_000);
        return <>No se pudo cobrar la renovación. Actualice la tarjeta antes del {date.format(readOnlyFrom)} para no perder el acceso.</>;
    }
    if (subscription.source === "paddle" && subscription.nextBilledAt && subscription.status === "active") {
        return <>Se renueva el {date.format(new Date(subscription.nextBilledAt))}.</>;
    }
    if (subscription.source === "manual" && subscription.currentPeriodEnd) {
        return <>Activado por Licitaly hasta el {date.format(new Date(subscription.currentPeriodEnd))}.</>;
    }
    return null;
}

export function CurrentPlan({ orgId, subscription, canManage }: { orgId: string; subscription: Subscription | null; canManage: boolean }) {
    if (!subscription) {
        return <p className="text-sm text-muted-foreground">La organización no tiene un plan. Elija uno para crear búsquedas y recibir reportes.</p>;
    }

    const hasPaddleCustomer = subscription.source === "paddle" && subscription.paddleCustomerId !== null;

    return (
        <div className="space-y-4">
            {subscription.status === "past_due" ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    <StatusLine subscription={subscription} />
                </p>
            ) : null}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-lg font-semibold tracking-tight">{subscription.planName}</p>
                        <Badge variant={subscription.status === "active" ? "secondary" : "outline"}>{STATUS_LABELS[subscription.status]}</Badge>
                    </div>
                    {subscription.status === "past_due" ? null : (
                        <p className="mt-1 text-sm text-muted-foreground">
                            <StatusLine subscription={subscription} />
                        </p>
                    )}
                </div>
                {canManage && hasPaddleCustomer ? (
                    <CustomerPortalButton orgId={orgId}>
                        {subscription.status === "past_due" ? "Actualizar la tarjeta" : "Tarjeta, facturas y cancelación"}
                    </CustomerPortalButton>
                ) : null}
            </div>
        </div>
    );
}
