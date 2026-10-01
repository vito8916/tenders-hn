"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { userErrorMessage } from "@/lib/errors";
import { saveFeedbackInputSchema, type SaveFeedbackInput } from "./schemas";
import { saveFeedbackService } from "./services";

/**
 * Server Action for «Me interesa» / «No me interesa»
 */
export async function saveFeedbackAction(input: SaveFeedbackInput): Promise<{ success: boolean; error?: string }> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = saveFeedbackInputSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
        }

        await saveFeedbackService({ userId, input: parsed.data });
        revalidatePath(`/organizations/${parsed.data.orgSlug}`);

        return { success: true };
    } catch (error) {
        console.error("Error saving opportunity feedback:", error);
        return { success: false, error: userErrorMessage(error, "No se pudo guardar. Intente de nuevo.") };
    }
}
