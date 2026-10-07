/**
 * An error whose message is written in Spanish for the user and can be shown as is.
 * Services throw it; anything else (Supabase, Zod, storage) is replaced by a generic message.
 */
export class UserFacingError extends Error {}

/**
 * Spanish messages for the exceptions the database raises in organization,
 * membership, invitation, company profile, search, and chat flows (`raise exception '<code>'` in supabase/migrations).
 * Postgres puts the code in the error message, so lookup is by substring.
 */
const DATABASE_ERROR_MESSAGES: Record<string, string> = {
    not_authenticated: "Su sesión venció. Inicie sesión de nuevo.",
    insufficient_role: "Su rol no le permite realizar esta acción.",
    subscription_inactive: "La organización no tiene una suscripción activa.",
    seat_limit_reached: "La organización alcanzó el límite de usuarios de su plan.",
    organizations_slug_key: "Ese identificador en la URL ya está en uso. Elija otro.",
    empty_profile: "Describa qué vende la empresa.",
    improvement_limit_reached: "Ya usó las 3 mejoras con IA de este campo por hoy. Podrá usarlas de nuevo mañana.",
    search_limit_reached: "La organización alcanzó el límite de búsquedas activas de su plan. Pause otra búsqueda para activar esta.",
    schedule_interval_not_allowed: "Su plan no permite ejecutar búsquedas con esa frecuencia.",
    saved_searches_org_name_key: "Ya existe una búsqueda con ese nombre.",
    search_not_found: "La búsqueda no existe o no tiene acceso a ella.",
    search_inactive: "La búsqueda está pausada. Reactívela para ejecutarla.",
    no_profile: "Guarde primero el perfil de la empresa.",
    run_in_progress: "Esta búsqueda ya se está ejecutando. Espere a que termine.",
    default_search_locked: "«Recomendadas» sigue el perfil de la empresa: no se puede eliminar, pausar ni renombrar.",
    insufficient_credits: "La organización no tiene créditos suficientes para esta pregunta.",
    chat_turn_exists: "Esa pregunta ya se envió.",
    chat_context_not_found: "El proceso o la ejecución no existe o ya no está disponible.",
    chat_model_unavailable: "El asistente no está disponible en este momento.",
    invalid_question: "Escriba una pregunta de hasta 2000 caracteres.",
};

/** The code of a known database error (a key of DATABASE_ERROR_MESSAGES) in the error's message. */
export function databaseErrorCode(error: unknown): string | undefined {
    // Supabase errors carry a message without always being Error instances.
    const raw = typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
    return Object.keys(DATABASE_ERROR_MESSAGES).find((key) => raw.includes(key));
}

export function userErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof UserFacingError) return error.message;
    const code = databaseErrorCode(error);
    return code ? DATABASE_ERROR_MESSAGES[code] : fallback;
}
