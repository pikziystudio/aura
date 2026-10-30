import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { validateSupabaseConfig } from "./supabase-config";

let browserClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  const { url, key } = validateSupabaseConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!browserClient) browserClient = createClient(url, key, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
  });
  return browserClient;
}
