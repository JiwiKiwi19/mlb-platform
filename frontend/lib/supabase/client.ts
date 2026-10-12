import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

let browserClient: SupabaseClient | undefined;

/**
 * One client (and therefore one realtime WebSocket) per browser tab.
 * Uses the anon key; RLS limits it to read-only access.
 */
export function getBrowserSupabase(): SupabaseClient {
  if (!browserClient) {
    const { url, anonKey } = supabaseEnv();
    browserClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return browserClient;
}
