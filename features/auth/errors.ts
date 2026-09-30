/**
 * Spanish messages for Supabase Auth error codes.
 * GoTrue's `error.message` is English, so user-facing text comes from `error.code`.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
    invalid_credentials: "El correo electrónico o la contraseña no son correctos.",
    email_not_confirmed: "Confirme su correo electrónico para continuar.",
    user_already_exists: "Ya existe una cuenta con este correo electrónico.",
    email_exists: "Ya existe una cuenta con este correo electrónico.",
    email_address_invalid: "Ingrese un correo electrónico válido.",
    weak_password: "La contraseña es muy débil. Use al menos 8 caracteres y combine letras y números.",
    same_password: "La nueva contraseña debe ser distinta de la actual.",
    over_email_send_rate_limit: "Se enviaron demasiados correos. Espere unos minutos e intente de nuevo.",
    over_request_rate_limit: "Demasiados intentos. Espere unos minutos e intente de nuevo.",
    otp_expired: "El código o enlace venció o no es válido. Solicite uno nuevo.",
    validation_failed: "Los datos ingresados no son válidos. Revíselos e intente de nuevo.",
    signup_disabled: "El registro de cuentas nuevas no está disponible.",
    user_not_found: "No encontramos una cuenta con este correo electrónico.",
    session_not_found: "Su sesión venció. Inicie sesión de nuevo.",
    reauthentication_needed: "Por seguridad, inicie sesión de nuevo para continuar.",
    provider_disabled: "Este método de inicio de sesión no está disponible.",
    flow_state_expired: "El enlace de inicio de sesión venció. Intente de nuevo.",
    flow_state_not_found: "El enlace de inicio de sesión no es válido. Intente de nuevo.",
    bad_oauth_callback: "No se pudo completar el inicio de sesión con el proveedor. Intente de nuevo.",
    bad_oauth_state: "No se pudo completar el inicio de sesión con el proveedor. Intente de nuevo.",
};

export const GENERIC_AUTH_ERROR_MESSAGE = "No se pudo completar la solicitud. Intente de nuevo.";

export function authErrorMessage(code: string | undefined | null) {
    return code && Object.hasOwn(AUTH_ERROR_MESSAGES, code)
        ? AUTH_ERROR_MESSAGES[code]
        : GENERIC_AUTH_ERROR_MESSAGE;
}
