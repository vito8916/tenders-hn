import Link from "next/link";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { OrgRole } from "@/features/memberships/schemas";
import { canManageBilling } from "../rbac";
import { isLiveSubscription } from "../schemas";
import { getBillingPageService } from "../services";
import { PlanOptions } from "./plan-options";

/** What an organization without an active plan shows in place of its pages (everything but Facturación). */
export async function PlanGate({ orgId, orgSlug, role }: { orgId: string; orgSlug: string; role: OrgRole }) {
    if (!canManageBilling(role)) {
        return (
            <Empty className="m-4 border lg:m-6">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <CreditCard />
                    </EmptyMedia>
                    <EmptyTitle>Sin plan activo</EmptyTitle>
                    <EmptyDescription>Su organización no tiene un plan activo. Pídale al propietario que elija uno.</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    const { subscription, plans } = await getBillingPageService(orgId);

    // A subscription that Paddle still holds (a failed renewal) is fixed in Facturación; a new checkout would create a second one.
    if (isLiveSubscription(subscription)) {
        return (
            <Empty className="m-4 border lg:m-6">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <CreditCard />
                    </EmptyMedia>
                    <EmptyTitle>Su plan no está activo</EmptyTitle>
                    <EmptyDescription>No se pudo cobrar la renovación. Revise el pago en Configuración › Facturación.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button asChild>
                        <Link href={`/organizations/${orgSlug}/settings/billing`}>Ir a Facturación</Link>
                    </Button>
                </EmptyContent>
            </Empty>
        );
    }

    return (
        <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">
            <div>
                <h1 className="text-2xl font-bold">Elija un plan para comenzar</h1>
                <p className="mt-1 text-muted-foreground">
                    Con su plan buscamos oportunidades en HonduCompras y le enviamos los reportes. Precios mensuales en dólares. Si tiene un código de
                    piloto, ingréselo al pagar.
                </p>
            </div>
            <PlanOptions
                orgId={orgId}
                orgSlug={orgSlug}
                plans={plans}
                currentPriceId={null}
                hasLiveSubscription={false}
                canManage
            />
        </div>
    );
}
