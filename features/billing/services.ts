import "server-only";
import { cacheLife } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getUserOrgRole } from "@/features/memberships/repository";
import { getPaddle } from "@/lib/paddle/server";
import { UserFacingError } from "@/lib/errors";
import { canManageBilling } from "./rbac";
import { getEntitlements, getPlanChangeBlockers, getPlanIdForPrice, getSubscription, getUsage, listPlanOptions } from "./repository";
import type { Database } from "@/types/database.types";
import { isLiveSubscription, type CheckoutOptions, type PlanChangeBlocker, type PlanChangePreview, type PlanOption, type PlanWithPrice } from "./schemas";

const BLOCKER_MESSAGES: Record<PlanChangeBlocker, string> = {
    members: "quite miembros o invitaciones pendientes",
    searches: "pause listas",
    report_times: "elija menos horarios de reporte en Configuración › Reportes",
};

/** Adds each plan's monthly amount in Paddle (tax included, O10). */
async function withPrices(plans: PlanOption[]): Promise<PlanWithPrice[]> {
    const prices = await Promise.all(plans.map((plan) => getPaddle().prices.get(plan.priceId)));
    const amounts = new Map(prices.map((price) => [price.id, { amount: price.unitPrice.amount, currencyCode: price.unitPrice.currencyCode }]));
    return plans.map((plan) => ({ ...plan, price: amounts.get(plan.priceId) ?? null }));
}

/** Plan, usage, and the plans for sale with their prices. */
export async function getBillingPageService(orgId: string) {
    const [subscription, plans, usage] = await Promise.all([getSubscription(orgId), listPlanOptions(), getUsage(orgId)]);
    return { subscription, usage, plans: await withPrices(plans) };
}

/** The plans for sale with their prices, for the onboarding plan step. */
export async function listPlansForSaleService() {
    return withPrices(await listPlanOptions());
}

/** The plans for sale on the landing page, read without a session and cached for an hour, so visits do not call Paddle. */
export async function getPublicPlansService() {
    "use cache";
    cacheLife("hours");
    const supabase = createSupabaseClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
    );
    return withPrices(await listPlanOptions(supabase));
}

/** Whether the organization's plan gives access yet; the app gate and onboarding (which waits for Paddle's webhook) read it. */
export async function hasActivePlanService(orgId: string) {
    return (await getEntitlements(orgId)).is_active;
}

/** Members plus pending invitations, which is how the plan counts seats. */
export async function getSeatsUsedService(orgId: string) {
    return (await getEntitlements(orgId)).seats_used;
}

async function assertOwner(userId: string, orgId: string) {
    const role = await getUserOrgRole({ userId, orgId });
    if (!role || !canManageBilling(role)) {
        throw new UserFacingError("Solo el propietario de la organización puede administrar el plan.");
    }
}

/** Checks that the owner can subscribe the organization and returns what Paddle's checkout opens with. */
export async function prepareCheckoutService(params: { userId: string; email?: string; orgId: string; priceId: string }): Promise<CheckoutOptions> {
    await assertOwner(params.userId, params.orgId);

    const [subscription, planId] = await Promise.all([getSubscription(params.orgId), getPlanIdForPrice(params.priceId)]);
    if (!planId) {
        throw new UserFacingError("Ese plan ya no está disponible.");
    }
    if (isLiveSubscription(subscription)) {
        throw new UserFacingError("La organización ya tiene un plan. Cámbielo desde esta página.");
    }

    return {
        priceId: params.priceId,
        customData: { org_id: params.orgId, user_id: params.userId },
        // The same Paddle customer keeps its payment history when an organization subscribes again.
        customer: subscription?.paddleCustomerId
            ? { id: subscription.paddleCustomerId }
            : params.email
              ? { email: params.email }
              : null,
    };
}

async function getChangeablePlan(params: { userId: string; orgId: string; priceId: string }) {
    await assertOwner(params.userId, params.orgId);

    const [subscription, planId] = await Promise.all([getSubscription(params.orgId), getPlanIdForPrice(params.priceId)]);
    if (!planId) {
        throw new UserFacingError("Ese plan ya no está disponible.");
    }
    if (!subscription?.paddleSubscriptionId || !isLiveSubscription(subscription)) {
        throw new UserFacingError("La organización no tiene un plan que se pueda cambiar.");
    }
    if (subscription.paddlePriceId === params.priceId) {
        throw new UserFacingError("La organización ya tiene ese plan.");
    }

    const blockers = await getPlanChangeBlockers(params.orgId, planId);
    if (blockers.length > 0) {
        throw new UserFacingError(`Ese plan tiene límites menores. Antes de cambiar, ${blockers.map((blocker) => BLOCKER_MESSAGES[blocker]).join("; ")}.`);
    }

    return {
        subscriptionId: subscription.paddleSubscriptionId,
        update: {
            items: [{ priceId: params.priceId, quantity: 1 }],
            prorationBillingMode: "prorated_immediately" as const,
        },
    };
}

/** What changing plan now would charge or credit, prorated for the rest of the period. */
export async function previewPlanChangeService(params: { userId: string; orgId: string; priceId: string }): Promise<PlanChangePreview | null> {
    const { subscriptionId, update } = await getChangeablePlan(params);
    const preview = await getPaddle().subscriptions.previewUpdate(subscriptionId, update);
    const result = preview.updateSummary?.result;
    return result ? { action: result.action, amount: result.amount, currencyCode: result.currencyCode } : null;
}

/** Changes plan now; the webhook updates the organization's row when Paddle confirms it. */
export async function changePlanService(params: { userId: string; orgId: string; priceId: string }) {
    const { subscriptionId, update } = await getChangeablePlan(params);
    // A failed charge for an upgrade leaves the current plan as it is.
    await getPaddle().subscriptions.update(subscriptionId, { ...update, onPaymentFailure: "prevent_change" });
}

/** A short-lived link to Paddle's customer portal: card, invoices, and cancellation. */
export async function getCustomerPortalUrlService(params: { userId: string; orgId: string }) {
    await assertOwner(params.userId, params.orgId);

    const subscription = await getSubscription(params.orgId);
    if (!subscription?.paddleCustomerId) {
        throw new UserFacingError("La organización todavía no tiene datos de pago.");
    }

    const session = await getPaddle().customerPortalSessions.create(
        subscription.paddleCustomerId,
        subscription.paddleSubscriptionId ? [subscription.paddleSubscriptionId] : [],
    );
    return session.urls.general.overview;
}
