export const AURA_SUPABASE_URL = "https://rwivnjxlmjctjdbxlfxf.supabase.co";

/** Fail closed on accidental project mixups or a privileged browser credential. */
export function validateSupabaseConfig(url: string | undefined, key: string | undefined) {
  if (!url || !key) throw Error("Supabase client configuration is missing.");
  if (url !== AURA_SUPABASE_URL) throw Error("Only the dedicated AURA Supabase project is allowed.");
  if (key.startsWith("sb_publishable_")) return { url, key };
  // Legacy anon JWTs remain supported; never accept a service-role JWT.
  try {
    const payload = key.split(".")[1];
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { role?: unknown };
    if (claims.role === "anon") return { url, key };
  } catch { /* Configuration errors never include the supplied value. */ }
  throw Error("Use an AURA publishable or legacy anon key, never a privileged key.");
}
