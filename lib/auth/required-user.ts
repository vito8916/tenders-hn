import {cache} from "react";
import {redirect} from "next/navigation";
import {getCurrentUser} from "@/lib/auth/get-current-user";
import {AuthUser} from "@/features/profiles/schemas";

/**
 * Ensures a user is authenticated, redirecting to login if not
 * Uses React cache for request deduplication
 *
 * @returns AuthUser object if authenticated
 * @throws Redirects to /login if not authenticated
 */
export const requireUser = cache(async (): Promise<AuthUser> => {
    try {
        return await getCurrentUser();
    } catch {
        // Redirect to login if authentication fails
        redirect("/login");
    }
});