"use server";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { updateProfileService } from "./services";
import { updateProfileInputSchema, type UpdateProfileInput } from "./schemas";
import { revalidatePath } from "next/cache";

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
        const validatedInput = updateProfileInputSchema.parse(input);

        // Update profile through service layer
        await updateProfileService({
            userId: user.sub,
            input: validatedInput,
        });

        // Revalidate paths that display profile data
        revalidatePath("/settings");
        revalidatePath("/organizations");

        return { success: "Profile updated successfully" };
    } catch (error) {
        console.error("Profile update error:", error);
        return { error: error instanceof Error ? error.message : "Failed to update profile" };
    }
}
