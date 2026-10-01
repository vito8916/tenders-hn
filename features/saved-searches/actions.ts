"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { userErrorMessage } from "@/lib/errors";
import { savedSearchInputSchema, type SavedSearchInput } from "./schemas";
import { deleteSavedSearchService, saveSavedSearchService, setSavedSearchActiveService } from "./services";

const searchRefSchema = z.object({
    orgId: z.uuid(),
    orgSlug: z.string().min(1),
    searchId: z.uuid(),
});

const saveSavedSearchActionSchema = searchRefSchema.extend({
    // Null creates the search.
    searchId: z.uuid().nullable(),
    search: savedSearchInputSchema,
});

// The Home lists the searches too.
const revalidateSearches = (orgSlug: string) => revalidatePath(`/organizations/${orgSlug}`, "layout");

/**
 * Server Action that creates or updates a saved search and returns its id
 */
export async function saveSavedSearchAction(input: {
    orgId: string;
    orgSlug: string;
    searchId: string | null;
    search: SavedSearchInput;
}): Promise<{ success: true; searchId: string } | { success: false; error: string }> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = saveSavedSearchActionSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Los datos ingresados no son válidos." };
        }

        const searchId = await saveSavedSearchService({
            userId,
            orgId: parsed.data.orgId,
            searchId: parsed.data.searchId,
            input: parsed.data.search,
        });

        revalidateSearches(parsed.data.orgSlug);

        return { success: true, searchId };
    } catch (error) {
        console.error("Error saving search:", error);
        return { success: false, error: userErrorMessage(error, "No se pudo guardar la búsqueda. Intente de nuevo.") };
    }
}

/**
 * Server Action that pauses or resumes a saved search
 */
export async function setSavedSearchActiveAction(input: {
    orgId: string;
    orgSlug: string;
    searchId: string;
    isActive: boolean;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = searchRefSchema.extend({ isActive: z.boolean() }).safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Los datos ingresados no son válidos." };
        }

        await setSavedSearchActiveService({ userId, ...parsed.data });

        revalidateSearches(parsed.data.orgSlug);

        return { success: true };
    } catch (error) {
        console.error("Error changing search state:", error);
        return { success: false, error: userErrorMessage(error, "No se pudo cambiar el estado de la búsqueda.") };
    }
}

/**
 * Server Action that deletes a saved search with its runs
 */
export async function deleteSavedSearchAction(input: {
    orgId: string;
    orgSlug: string;
    searchId: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = searchRefSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Los datos ingresados no son válidos." };
        }

        await deleteSavedSearchService({ userId, ...parsed.data });

        revalidateSearches(parsed.data.orgSlug);

        return { success: true };
    } catch (error) {
        console.error("Error deleting search:", error);
        return { success: false, error: userErrorMessage(error, "No se pudo eliminar la búsqueda.") };
    }
}
