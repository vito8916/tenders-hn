"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { userErrorMessage } from "@/lib/errors";
import { requestSearchRunSchema } from "./schemas";
import { requestSearchRunService } from "./services";

/**
 * Server Action for «Ejecutar ahora»: queues a run of a saved search
 */
export async function requestSearchRunAction(input: { searchId: string; orgSlug: string }): Promise<{ success: boolean; error?: string }> {
    try {
        await getCurrentUser();

        const parsed = requestSearchRunSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
        }

        await requestSearchRunService(parsed.data.searchId);

        // The Home and the search pages both show runs.
        revalidatePath(`/organizations/${parsed.data.orgSlug}`, "layout");

        return { success: true };
    } catch (error) {
        console.error("Error requesting search run:", error);
        return { success: false, error: userErrorMessage(error, "No se pudo iniciar la búsqueda.") };
    }
}
