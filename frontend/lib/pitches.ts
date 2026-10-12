import type { Pitch, PitchStats, PitchTypeStats, ZoneEval } from "@/lib/types";

/** Rolling window shown across the dashboard (server fetch and realtime buffer). */
export const PITCH_WINDOW = 50;

/** Columns selected from live_pitches; keep in sync with the Pitch type. */
export const PITCH_COLUMNS =
  "id, unique_id, game_id, pitch_type, speed_mph, zone_x, zone_z, zone_eval, pitcher_id, pitcher_full_name, pitcher_team, inning, timestamp, created_at";

const ZONE_EVALS: readonly ZoneEval[] = ["IN ZONE", "OUT OF ZONE", "Unknown"];

const numberOrNull = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const stringOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

/**
 * Narrow an untrusted row (SSR query result or realtime payload) to a Pitch.
 * Returns null for rows missing their identity fields.
 */
export function parsePitch(row: unknown): Pitch | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = numberOrNull(r.id);
  const uniqueId = stringOrNull(r.unique_id);
  const createdAt = stringOrNull(r.created_at);
  if (id === null || !uniqueId || !createdAt) return null;

  const zoneEval = ZONE_EVALS.includes(r.zone_eval as ZoneEval) ? (r.zone_eval as ZoneEval) : "Unknown";

  return {
    id,
    unique_id: uniqueId,
    game_id: numberOrNull(r.game_id),
    pitch_type: stringOrNull(r.pitch_type) ?? "Unknown",
    speed_mph: numberOrNull(r.speed_mph),
    zone_x: numberOrNull(r.zone_x),
    zone_z: numberOrNull(r.zone_z),
    zone_eval: zoneEval,
    pitcher_id: stringOrNull(r.pitcher_id),
    pitcher_full_name: stringOrNull(r.pitcher_full_name) ?? "Unknown",
    pitcher_team: stringOrNull(r.pitcher_team),
    inning: numberOrNull(r.inning),
    timestamp: stringOrNull(r.timestamp),
    created_at: createdAt,
  };
}

export function parsePitches(rows: readonly unknown[] | null | undefined): Pitch[] {
  return (rows ?? []).map(parsePitch).filter((p): p is Pitch => p !== null);
}

/**
 * Merge incoming pitches into a newest-first list: dedupe by unique_id
 * (incoming wins), order by insertion id, and cap the size.
 * Returns `current` unchanged when nothing new arrived, so React can bail out.
 */
export function mergePitches(current: Pitch[], incoming: Pitch[], limit = PITCH_WINDOW): Pitch[] {
  if (incoming.length === 0) return current;
  const byId = new Map<string, Pitch>();
  for (const p of current) byId.set(p.unique_id, p);
  let changed = false;
  for (const p of incoming) {
    const existing = byId.get(p.unique_id);
    if (!existing || existing.id !== p.id || existing.speed_mph !== p.speed_mph) changed = true;
    byId.set(p.unique_id, p);
  }
  if (!changed) return current;
  return Array.from(byId.values())
    .sort((a, b) => b.id - a.id)
    .slice(0, limit);
}

export const isInZone = (p: Pick<Pitch, "zone_eval">) => p.zone_eval === "IN ZONE";

export function computeStats(pitches: readonly Pitch[]): PitchStats {
  let max = 0;
  let sum = 0;
  let measured = 0;
  let inZone = 0;
  const types = new Map<string, { sum: number; measured: number; count: number }>();

  for (const p of pitches) {
    if (isInZone(p)) inZone += 1;
    const t = types.get(p.pitch_type) ?? { sum: 0, measured: 0, count: 0 };
    t.count += 1;
    if (p.speed_mph !== null) {
      max = Math.max(max, p.speed_mph);
      sum += p.speed_mph;
      measured += 1;
      t.sum += p.speed_mph;
      t.measured += 1;
    }
    types.set(p.pitch_type, t);
  }

  const byType: PitchTypeStats[] = Array.from(types, ([pitchType, t]) => ({
    pitchType,
    count: t.count,
    avgVelocity: t.measured ? t.sum / t.measured : 0,
  })).sort((a, b) => b.count - a.count || a.pitchType.localeCompare(b.pitchType));

  return {
    count: pitches.length,
    maxVelocity: max,
    avgVelocity: measured ? sum / measured : 0,
    inZone,
    zonePercentage: pitches.length ? (inZone / pitches.length) * 100 : 0,
    byType,
  };
}

// A fixed locale and time zone make server and client render identical text,
// which avoids hydration mismatches. MLB publishes game times in ET.
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "America/New_York",
});

export function formatPitchTime(iso: string | null): string {
  if (!iso) return "--:--:--";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "--:--:--" : timeFormatter.format(date);
}
