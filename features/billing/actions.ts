"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { userErrorMessage } from "@/lib/errors";
import { checkoutInputSchema, planChangeInputSchema, portalInputSchema, type CheckoutOptions, type PlanChangePreview } from "./schemas";
import { changePlanService, getCustomerPortalUrlService, prepareCheckoutService, previewPlanChangeService } from "./services";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

const invalidInput = (issues: { message: string }[]): { success: false; error: string } => ({
    success: false,
    error: issues[0]?.message ?? "Los datos ingresados no son válidos.",
});

/**
 * Server Action that checks the owner can subscribe and returns the options Paddle's checkout opens with
 */
export async function prepareCheckoutAction(input: { orgId: string; orgSlug: string; priceId: string }): Promise<ActionResult<CheckoutOptions>> {
    try {
        const { sub: userId, email } = await getCurrentUser();

        const parsed = checkoutInputSchema.safeParse(input);
        if (!parsed.success) return invalidInput(parsed.error.issues);

        return { success: true, data: await prepareCheckoutService({ userId, email, orgId: parsed.data.orgId, priceId: parsed.data.priceId }) };
    } catch (error) {
        console.error("Error preparing checkout:", error);
        return { success: false, error: userErrorMessage(error, "No se pudo abrir el pago. Intente de nuevo.") };
    }
}

/**
 * Server Action that previews what a plan change charges or credits now
 */
export async function previewPlanChangeAction(input: { orgId: string; orgSlug: string; priceId: string }): Promise<ActionResult<PlanChangePreview | null>> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = planChangeInputSchema.safeParse(input);
        if (!parsed.success) return invalidInput(parsed.error.issues);

        return { success: true, data: await previewPlanChangeService({ userId, orgId: parsed.data.orgId, priceId: parsed.data.priceId }) };
    } catch (error) {
        console.error("Error previewing plan change:", error);
        return { success: false, error: userErrorMessage(error, "No se pudo calcular el cambio de plan. Intente de nuevo.") };
    }
}

/**
 * Server Action that changes the organization's plan in Paddle
 */
export async function changePlanAction(input: { orgId: string; orgSlug: string; priceId: string }): Promise<ActionResult<null>> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = planChangeInputSchema.safeParse(input);
        if (!parsed.success) return invalidInput(parsed.error.issues);

        await changePlanService({ userId, orgId: parsed.data.orgId, priceId: parsed.data.priceId });
        revalidatePath(`/organizations/${parsed.data.orgSlug}/settings/billing`);

        return { success: true, data: null };
    } catch (error) {
        console.error("Error changing plan:", error);
        return { success: false, error: userErrorMessage(error, "No se pudo cambiar el plan. Intente de nuevo.") };
    }
}

/**
 * Server Action that returns a link to Paddle's customer portal
 */
export async function getCustomerPortalUrlAction(input: { orgId: string }): Promise<ActionResult<string>> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = portalInputSchema.safeParse(input);
        if (!parsed.success) return invalidInput(parsed.error.issues);

        return { success: true, data: await getCustomerPortalUrlService({ userId, orgId: parsed.data.orgId }) };
    } catch (error) {
        console.error("Error opening customer portal:", error);
        return { success: false, error: userErrorMessage(error, "No se pudo abrir el portal de pagos. Intente de nuevo.") };
    }
}
