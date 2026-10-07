import { z } from "zod";

export const SubscriptionStatusSchema = z.enum(["trialing", "active", "past_due", "paused", "canceled", "expired"]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const subscriptionSchema = z.object({
    planId: z.string(),
    planName: z.string(),
    status: SubscriptionStatusSchema,
    source: z.enum(["manual", "paddle"]),
    currentPeriodEnd: z.string().nullable(),
    nextBilledAt: z.string().nullable(),
    scheduledChange: z.object({ action: z.enum(["cancel", "pause", "resume"]), effective_at: z.string() }).nullable(),
    pastDueSince: z.string().nullable(),
    paddleSubscriptionId: z.string().nullable(),
    paddleCustomerId: z.string().nullable(),
    paddlePriceId: z.string().nullable(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

/** A Paddle subscription that is still running: a new checkout would create a second one. */
export const isLiveSubscription = (subscription: Subscription | null) =>
    subscription !== null && subscription.source === "paddle" && subscription.status !== "canceled" && subscription.status !== "expired";

export const planOptionSchema = z.object({
    planId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    maxMembers: z.number().int().nullable(),
    maxActiveSearches: z.number().int().nullable(),
    historyMonths: z.number().int().nullable(),
    monthlyAiCredits: z.number().int(),
    /** Report times a day the plan allows; null = every sync (up to 8). */
    maxDailyReports: z.number().int().nullable(),
    priceId: z.string(),
});
export type PlanOption = z.infer<typeof planOptionSchema>;

/** A plan for sale with its monthly amount in Paddle (tax included, O10); null when Paddle did not return it. */
export type PlanWithPrice = PlanOption & { price: { amount: string; currencyCode: string } | null };

/** The limits a plan card lists, the same on the landing page, onboarding, and Facturación. */
export function planFeatures(plan: PlanOption): string[] {
    return [
        plan.maxActiveSearches === null ? "Búsquedas ilimitadas" : `${plan.maxActiveSearches} búsquedas activas`,
        plan.maxDailyReports === null ? "Un reporte en cada actualización (hasta 8 al día)" : `${plan.maxDailyReports} reportes al día con Excel`,
        plan.maxMembers === null ? "Usuarios ilimitados" : `${plan.maxMembers} usuarios`,
        plan.historyMonths === null ? "Historial completo" : `${plan.historyMonths} meses de historial`,
        `${plan.monthlyAiCredits.toLocaleString("es-HN")} créditos de IA al mes`,
    ];
}

export const usageSchema = z.object({
    hasAccess: z.boolean(),
    seatsUsed: z.number().int(),
    maxMembers: z.number().int().nullable(),
    activeSearches: z.number().int(),
    maxActiveSearches: z.number().int().nullable(),
    creditsAvailable: z.number().int().nullable(),
    creditsGranted: z.number().int().nullable(),
});
export type Usage = z.infer<typeof usageSchema>;

export const PLAN_CHANGE_BLOCKERS = ["members", "searches", "report_times"] as const;
export type PlanChangeBlocker = (typeof PLAN_CHANGE_BLOCKERS)[number];

const priceRefSchema = z.object({ orgId: z.uuid(), orgSlug: z.string().min(1), priceId: z.string().regex(/^pri_[a-z0-9]{26}$/) });
export const checkoutInputSchema = priceRefSchema;
export const planChangeInputSchema = priceRefSchema;
export const portalInputSchema = z.object({ orgId: z.uuid() });

/** What the browser needs to open Paddle's checkout for the organization. */
export type CheckoutOptions = {
    priceId: string;
    customData: { org_id: string; user_id: string };
    customer: { id: string } | { email: string } | null;
};

/** What a plan change costs now: Paddle charges or credits the difference for the rest of the period. */
export type PlanChangePreview = { action: "charge" | "credit"; amount: string; currencyCode: string };
