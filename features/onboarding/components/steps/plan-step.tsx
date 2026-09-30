"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlanCard } from "@/features/billing/components/plan-card";
import type { PlanWithPrice } from "@/features/billing/schemas";

export function PlanStep({
    plans,
    preselectedPlanId,
    disabled,
    onChoose,
}: {
    plans: PlanWithPrice[];
    /** The plan chosen on the landing page, if any. */
    preselectedPlanId: string | null;
    disabled: boolean;
    onChoose: (plan: PlanWithPrice) => void;
}) {
    return (
        <div className="w-full space-y-8">
            <div>
                <h2 className="text-2xl font-bold">Elija su plan</h2>
                <p className="text-muted-foreground mt-1">
                    Precios mensuales en dólares, con impuestos incluidos. Si tiene un código de piloto, ingréselo al
                    pagar. Puede cambiar de plan o cancelar cuando quiera en Configuración › Facturación.
                </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                {plans.map((plan) => {
                    const isPreselected = plan.planId === preselectedPlanId;
                    return (
                        <PlanCard
                            key={plan.planId}
                            plan={plan}
                            highlighted={isPreselected}
                            badge={isPreselected ? <Badge>Su elección</Badge> : null}
                        >
                            <Button
                                className="mt-auto"
                                variant={isPreselected || preselectedPlanId === null ? "default" : "outline"}
                                disabled={disabled}
                                onClick={() => onChoose(plan)}
                            >
                                Elegir {plan.name}
                            </Button>
                        </PlanCard>
                    );
                })}
            </div>
        </div>
    );
}
