import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import { PLAN_CHANGE_BLOCKERS, planOptionSchema, subscriptionSchema, usageSchema, type PlanChangeBlocker, type PlanOption, type Subscription, type Usage } from "./schemas";

// ========== QUERIES ==========

export async function getSubscription(orgId: string): Promise<Subscription | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("organization_subscriptions")
        .select(
            "plan_id, status, source, current_period_end, next_billed_at, scheduled_change, past_due_since, paddle_subscription_id, paddle_customer_id, paddle_price_id, plans (name)",
        )
        .eq("org_id", orgId)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return subscriptionSchema.parse({
        planId: data.plan_id,
        planName: z.object({ name: z.string() }).parse(data.plans).name,
        status: data.status,
        source: data.source,
        currentPeriodEnd: data.current_period_end,
        nextBilledAt: data.next_billed_at,
        scheduledChange: data.scheduled_change,
        pastDueSince: data.past_due_since,
        paddleSubscriptionId: data.paddle_subscription_id,
        paddleCustomerId: data.paddle_customer_id,
        paddlePriceId: data.paddle_price_id,
    });
}

/**
 * The plans for sale with their monthly Paddle price, cheapest first. The
 * landing page passes a client without a session (anon reads the catalog).
 */
export async function listPlanOptions(client?: SupabaseClient<Database>): Promise<PlanOption[]> {
    const supabase = client ?? (await createClient());
    const { data, error } = await supabase
        .from("plan_prices")
        .select(
            "paddle_price_id, plans!inner (id, name, description, max_members, max_active_searches, history_months, monthly_ai_credits, max_daily_reports, sort_order, is_archived)",
        )
        .eq("is_active", true)
        .eq("billing_interval", "month")
        .eq("plans.is_archived", false);

    if (error) throw error;

    const planRowSchema = z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        max_members: z.number().nullable(),
        max_active_searches: z.number().nullable(),
        history_months: z.number().nullable(),
        monthly_ai_credits: z.number(),
        max_daily_reports: z.number().nullable(),
        sort_order: z.number(),
    });
    return data
        .map((row) => ({ priceId: row.paddle_price_id, plan: planRowSchema.parse(row.plans) }))
        .sort((a, b) => a.plan.sort_order - b.plan.sort_order)
        .map(({ priceId, plan }) =>
            planOptionSchema.parse({
                planId: plan.id,
                name: plan.name,
                description: plan.description,
                maxMembers: plan.max_members,
                maxActiveSearches: plan.max_active_searches,
                historyMonths: plan.history_months,
                monthlyAiCredits: plan.monthly_ai_credits,
                maxDailyReports: plan.max_daily_reports,
                priceId,
            }),
        );
}

/** Every plan's display name by id, archived plans included: past events still name them. */
export async function getPlanNames(): Promise<Record<string, string>> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("plans").select("id, name");
    if (error) throw error;
    return Object.fromEntries(data.map((plan) => [plan.id, plan.name]));
}

export async function getPlanIdForPrice(priceId: string): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("plan_prices").select("plan_id").eq("paddle_price_id", priceId).eq("is_active", true).maybeSingle();

    if (error) throw error;
    return data?.plan_id ?? null;
}

const entitlementsSchema = z
    .array(z.object({ is_active: z.boolean(), seats_used: z.number(), max_members: z.number().nullable(), max_active_searches: z.number().nullable() }))
    .length(1);

/** The organization's plan limits and whether its plan is active; seats count members and pending invitations. */
export async function getEntitlements(orgId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_organization_entitlements", { target_org: orgId });
    if (error) throw error;

    const [plan] = entitlementsSchema.parse(data);
    return plan;
}

export async function getUsage(orgId: string): Promise<Usage> {
    const supabase = await createClient();
    const [plan, credits, searches] = await Promise.all([
        getEntitlements(orgId),
        supabase.rpc("get_ai_credit_balance", { target_org: orgId }),
        // «Recomendadas» is not a list and does not count toward the plan.
        supabase.from("saved_searches").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("is_active", true).eq("is_default", false),
    ]);
    if (credits.error) throw credits.error;
    if (searches.error) throw searches.error;

    const [balance] = z.array(z.object({ available: z.number(), granted: z.number() })).parse(credits.data);

    return usageSchema.parse({
        hasAccess: plan.is_active,
        seatsUsed: plan.seats_used,
        maxMembers: plan.max_members,
        activeSearches: searches.count ?? 0,
        maxActiveSearches: plan.max_active_searches,
        creditsAvailable: balance?.available ?? null,
        creditsGranted: balance?.granted ?? null,
    });
}

/** What keeps the organization from moving to a plan now; empty when it fits. */
export async function getPlanChangeBlockers(orgId: string, planId: string): Promise<PlanChangeBlocker[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("plan_change_blockers", { target_org: orgId, target_plan: planId });

    if (error) throw error;
    return z.array(z.enum(PLAN_CHANGE_BLOCKERS)).parse(data ?? []);
}
