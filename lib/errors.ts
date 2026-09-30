/**
 * An error whose message is written in Spanish for the user and can be shown as is.
 * Services throw it; anything else (Supabase, Zod, storage) is replaced by a generic message.
 */
export class UserFacingError extends Error {}

/**
 * Spanish messages for the exceptions the database raises in organization,
 * membership, and invitation flows (`raise exception '<code>'` in supabase/migrations).
 * Postgres puts the code in the error message, so lookup is by substring.
 */
const DATABASE_ERROR_MESSAGES: Record<string, string> = {
    not_authenticated: "Su sesión venció. Inicie sesión de nuevo.",
    insufficient_role: "Su rol no le permite realizar esta acción.",
    subscription_inactive: "La organización no tiene una suscripción activa.",
    seat_limit_reached: "La organización alcanzó el límite de usuarios de su plan.",
    organizations_slug_key: "Ese identificador en la URL ya está en uso. Elija otro.",
};

export function userErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof UserFacingError) return error.message;
    // Supabase errors carry a message without always being Error instances.
    const raw = typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
    const code = Object.keys(DATABASE_ERROR_MESSAGES).find((key) => raw.includes(key));
    return code ? DATABASE_ERROR_MESSAGES[code] : fallback;
}
