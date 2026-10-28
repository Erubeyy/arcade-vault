export const USERNAME_RE = /^[A-Z0-9_]{3,10}$/;
export const PASSWORD_MIN = 8;
export const RESERVED_USERNAME = "INVITADO";

export function normalizeUsername(raw: string): string {
  return raw.trim().toUpperCase();
}

// Devuelve el mensaje de error o null si el username es válido.
export function validateUsername(u: string): string | null {
  const name = normalizeUsername(u);
  if (name.length < 3) return "El username debe tener al menos 3 caracteres.";
  if (name.length > 10) return "El username admite máximo 10 caracteres.";
  if (!USERNAME_RE.test(name))
    return "Usa solo letras, números y guion bajo (sin espacios ni símbolos).";
  if (name === RESERVED_USERNAME) return "Ese username está reservado.";
  return null;
}

export function validatePassword(p: string): string | null {
  if (p.length < PASSWORD_MIN)
    return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  return null;
}

export function authErrorMessage(error: {
  code?: string;
  message: string;
}): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.";
    case "user_already_exists":
    case "email_exists":
      return "Ese correo ya está registrado.";
    case "weak_password":
      return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit":
      return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
    case "provider_disabled":
      return "Este proveedor no está habilitado todavía.";
  }

  const msg = error.message.toLowerCase();
  // El trigger on_auth_user_created falla con la restricción unique de username.
  if (
    msg.includes("database error saving new user") ||
    msg.includes("profiles_username_key") ||
    msg.includes("duplicate key")
  )
    return "Ese username ya está ocupado.";
  if (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("fetch failed")
  )
    return "Error de red. Revisa tu conexión e inténtalo de nuevo.";
  if (msg.includes("invalid login credentials"))
    return "Correo o contraseña incorrectos.";
  if (msg.includes("email not confirmed"))
    return "Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.";
  if (msg.includes("already registered"))
    return "Ese correo ya está registrado.";
  if (msg.includes("rate limit"))
    return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";

  return "Ocurrió un error inesperado. Inténtalo de nuevo.";
}
