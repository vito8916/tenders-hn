// Browsers scope cookies by host, not port. Without an explicit name every local
// Supabase app on 127.0.0.1 uses `sb-127-auth-token`, so signing into one local
// project would overwrite the session of another.
export const authCookieOptions = { name: "sb-tenders-hn-auth-token" };
