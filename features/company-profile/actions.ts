"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { userErrorMessage } from "@/lib/errors";
import {
    companyProfileInputSchema,
    improveProfileFieldInputSchema,
    type CompanyProfileInput,
    type ImproveProfileFieldInput,
} from "./schemas";
import { improveProfileFieldService, saveCompanyProfileService } from "./services";

const saveCompanyProfileActionSchema = z.object({
    orgId: z.uuid(),
    orgSlug: z.string().min(1),
    profile: companyProfileInputSchema,
});

/**
 * Server Action that saves the company profile from settings
 */
export async function saveCompanyProfileAction(input: {
    orgId: string;
    orgSlug: string;
    profile: CompanyProfileInput;
}): Promise<{ success: boolean; error?: string }> {
    try {
        await getCurrentUser();

        const parsed = saveCompanyProfileActionSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Los datos ingresados no son válidos." };
        }

        await saveCompanyProfileService({ orgId: parsed.data.orgId, input: parsed.data.profile });

        revalidatePath(`/organizations/${parsed.data.orgSlug}`, "layout");

        return { success: true };
    } catch (error) {
        console.error("Error saving company profile:", error);
        return { success: false, error: userErrorMessage(error, "No se pudo guardar el perfil de la empresa. Intente de nuevo.") };
    }
}

/**
 * Server Action for «Mejorar con IA»: returns the improved field and the
 * improvements of that field left today. Nothing is saved.
 */
export async function improveProfileFieldAction(
    input: ImproveProfileFieldInput,
): Promise<{ success: true; value: string | string[]; remaining: number } | { success: false; error: string }> {
    try {
        await getCurrentUser();

        const parsed = improveProfileFieldInputSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Los datos ingresados no son válidos." };
        }

        const { value, remaining } = await improveProfileFieldService(parsed.data);
        return { success: true, value, remaining };
    } catch (error) {
        console.error("Error improving company profile field:", error);
        return { success: false, error: userErrorMessage(error, "No se pudo mejorar el texto. Intente de nuevo.") };
    }
}
