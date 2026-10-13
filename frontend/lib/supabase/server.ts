import { createClient } from "@supabase/supabase-js";
import { ALERT_COLUMNS, ALERT_WINDOW, parseAlert } from "@/lib/alerts";
import { PITCH_COLUMNS, PITCH_WINDOW, parsePitch } from "@/lib/pitches";
import { parseRows } from "@/lib/rows";
import type { Pitch, PitchAlert } from "@/lib/types";
import { supabaseEnv } from "./env";

/**
 * Latest rows of a table, newest first, for the initial server render.
 * Never throws: on failure the page renders empty and the client backfills on connect.
 */
async function fetchRecent<T>(
  table: string,
  columns: string,
  limit: number,
  parse: (row: unknown) => T | null,
): Promise<T[]> {
  try {
    const { url, anonKey } = supabaseEnv();
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.from(table).select(columns).order("id", { ascending: false }).limit(limit);
    if (error) throw error;
    return parseRows(data, parse);
  } catch (err) {
    console.error(`[fetchRecent:${table}] initial load failed`, err);
    return [];
  }
}

export function fetchRecentPitches(limit = PITCH_WINDOW): Promise<Pitch[]> {
  return fetchRecent("live_pitches", PITCH_COLUMNS, limit, parsePitch);
}

export function fetchRecentAlerts(limit = ALERT_WINDOW): Promise<PitchAlert[]> {
  return fetchRecent("pitch_alerts", ALERT_COLUMNS, limit, parseAlert);
}
