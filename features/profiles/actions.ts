"use server";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { updateProfileService } from "./services";
import { updateProfileInputSchema, type UpdateProfileInput } from "./schemas";
import { revalidatePath } from "next/cache";
import { userErrorMessage } from "@/lib/errors";

/**
 * Server action to update the current user's profile
 * @param input - Profile update data
 * @returns Success/error response
 */
export async function updateProfileAction(input: UpdateProfileInput) {
    try {
        // Get current user
        const user = await getCurrentUser();

        // Validate input
        const parsed = updateProfileInputSchema.safeParse(input);
        if (!parsed.success) {
            return { error: parsed.error.issues[0]?.message ?? "Los datos ingresados no son válidos." };
        }

        // Update profile through service layer
        await updateProfileService({
            userId: user.sub,
            input: parsed.data,
        });

        // Revalidate paths that display profile data
        revalidatePath("/settings");
        revalidatePath("/organizations");

        return { success: "Se actualizó su perfil." };
    } catch (error) {
        console.error("Profile update error:", error);
        return { error: userErrorMessage(error, "No se pudo actualizar su perfil. Intente de nuevo.") };
    }
}
