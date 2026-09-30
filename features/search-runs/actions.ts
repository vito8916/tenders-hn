"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { requestSearchRunSchema } from "./schemas";
import { requestSearchRunService } from "./services";

/**
 * Server Action that saves the company profile and starts a search run
 */
export async function requestSearchRunAction(input: {
    orgId: string;
    orgSlug: string;
    description: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        await getCurrentUser();

        const parsed = requestSearchRunSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
        }

        await requestSearchRunService({ orgId: parsed.data.orgId, description: parsed.data.description });

        revalidatePath(`/organizations/${parsed.data.orgSlug}/inbox`);

        return { success: true };
    } catch (error) {
        console.error("Error requesting search run:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "No se pudo iniciar la búsqueda.",
        };
    }
}
