import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { planFeatures, type PlanWithPrice } from "../schemas";
import { formatMoney } from "./format-money";

/** A plan for sale in the app (Facturación and onboarding): price, limits, and the caller's badge and action. */
export function PlanCard({
    plan,
    highlighted,
    badge,
    children,
}: {
    plan: PlanWithPrice;
    highlighted: boolean;
    badge?: React.ReactNode;
    children?: React.ReactNode;
}) {
    return (
        <div className={cn("flex flex-col gap-4 rounded-lg border p-5", highlighted && "border-primary")}>
            <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{plan.name}</h3>
                    {badge}
                </div>
                <p className="text-2xl font-semibold tracking-tight">
                    {plan.price ? formatMoney(plan.price.amount, plan.price.currencyCode) : "—"}
                    <span className="text-sm font-normal text-muted-foreground"> al mes</span>
                </p>
                <p className="text-xs text-muted-foreground">Impuestos incluidos</p>
                {plan.description ? <p className="text-sm text-muted-foreground">{plan.description}</p> : null}
            </div>
            <ul className="space-y-1.5 text-sm">
                {planFeatures(plan).map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                        <Check className="size-4 text-muted-foreground" />
                        {feature}
                    </li>
                ))}
            </ul>
            {children}
        </div>
    );
}
