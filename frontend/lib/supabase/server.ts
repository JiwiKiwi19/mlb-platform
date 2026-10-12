import { createClient } from "@supabase/supabase-js";
import { PITCH_COLUMNS, PITCH_WINDOW, parsePitches } from "@/lib/pitches";
import type { Pitch } from "@/lib/types";
import { supabaseEnv } from "./env";

/** Latest pitches for the initial server render. Never throws: the client backfills on connect. */
export async function fetchRecentPitches(limit = PITCH_WINDOW): Promise<Pitch[]> {
  try {
    const { url, anonKey } = supabaseEnv();
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("live_pitches")
      .select(PITCH_COLUMNS)
      .order("id", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return parsePitches(data);
  } catch (err) {
    console.error("[fetchRecentPitches] initial load failed", err);
    return [];
  }
}
