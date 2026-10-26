"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { userErrorMessage } from "@/lib/errors";
import {
    addNoteInputSchema,
    deleteNoteInputSchema,
    saveTrackingInputSchema,
    type AddNoteInput,
    type DeleteNoteInput,
    type SaveTrackingInput,
} from "./schemas";
import { addNoteService, deleteNoteService, saveTrackingService } from "./services";

type ActionResult = { success: boolean; error?: string };

/** An opportunity's status and assignee (spec 0.4 §5). */
export async function saveTrackingAction(input: SaveTrackingInput): Promise<ActionResult> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = saveTrackingInputSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
        }

        await saveTrackingService({ userId, input: parsed.data });
        revalidatePath(`/organizations/${parsed.data.orgSlug}`, "layout");

        return { success: true };
    } catch (error) {
        console.error("Error saving opportunity tracking:", error);
        return { success: false, error: userErrorMessage(error, "No se pudo guardar. Intente de nuevo.") };
    }
}

export async function addNoteAction(input: AddNoteInput): Promise<ActionResult> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = addNoteInputSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
        }

        await addNoteService({ userId, input: parsed.data });
        revalidatePath(`/organizations/${parsed.data.orgSlug}`, "layout");

        return { success: true };
    } catch (error) {
        console.error("Error adding opportunity note:", error);
        return { success: false, error: userErrorMessage(error, "No se pudo guardar la nota. Intente de nuevo.") };
    }
}

export async function deleteNoteAction(input: DeleteNoteInput): Promise<ActionResult> {
    try {
        const { sub: userId } = await getCurrentUser();

        const parsed = deleteNoteInputSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
        }

        await deleteNoteService({ userId, input: parsed.data });
        revalidatePath(`/organizations/${parsed.data.orgSlug}`, "layout");

        return { success: true };
    } catch (error) {
        console.error("Error deleting opportunity note:", error);
        return { success: false, error: userErrorMessage(error, "No se pudo borrar la nota. Intente de nuevo.") };
    }
}
