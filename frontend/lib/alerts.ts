import { mergeRows, parseRows } from "@/lib/rows";
import type { PitchAlert } from "@/lib/types";

/** Alerts kept in memory and shown on the alerts page. */
export const ALERT_WINDOW = 25;

/** Columns selected from pitch_alerts; keep in sync with the PitchAlert type. */
export const ALERT_COLUMNS =
  "id, unique_id, pitch_unique_id, game_id, pitcher_id, pitcher_name, team, pitch_type, alert_type, message, severity, baseline_mph, recent_mph, delta_mph, created_at";

const SEVERITIES: readonly PitchAlert["severity"][] = ["info", "warning", "critical"];

const numberOrNull = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const stringOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** Narrow an untrusted pitch_alerts row. Returns null when identity or required text is missing. */
export function parseAlert(row: unknown): PitchAlert | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = numberOrNull(r.id);
  const uniqueId = stringOrNull(r.unique_id);
  const pitcherId = stringOrNull(r.pitcher_id);
  const message = stringOrNull(r.message);
  const createdAt = stringOrNull(r.created_at);
  if (id === null || !uniqueId || !pitcherId || !message || !createdAt) return null;

  return {
    id,
    unique_id: uniqueId,
    pitch_unique_id: stringOrNull(r.pitch_unique_id),
    game_id: numberOrNull(r.game_id),
    pitcher_id: pitcherId,
    pitcher_name: stringOrNull(r.pitcher_name),
    team: stringOrNull(r.team),
    pitch_type: stringOrNull(r.pitch_type),
    alert_type: stringOrNull(r.alert_type) ?? "Alert",
    message,
    severity: SEVERITIES.includes(r.severity as PitchAlert["severity"])
      ? (r.severity as PitchAlert["severity"])
      : "warning",
    baseline_mph: numberOrNull(r.baseline_mph),
    recent_mph: numberOrNull(r.recent_mph),
    delta_mph: numberOrNull(r.delta_mph),
    created_at: createdAt,
  };
}

export function parseAlerts(rows: readonly unknown[] | null | undefined): PitchAlert[] {
  return parseRows(rows, parseAlert);
}

/** Alerts are immutable once written, so identity by id is enough. */
export function mergeAlerts(current: PitchAlert[], incoming: readonly PitchAlert[], limit = ALERT_WINDOW) {
  return mergeRows(current, incoming, limit);
}

/** How many of `incoming` are not already in `current` (by unique_id). */
export function countNew(current: readonly PitchAlert[], incoming: readonly PitchAlert[]): number {
  const known = new Set(current.map((a) => a.unique_id));
  let added = 0;
  for (const alert of incoming) {
    if (!known.has(alert.unique_id)) {
      known.add(alert.unique_id);
      added += 1;
    }
  }
  return added;
}

export type AlertStats = {
  count: number;
  critical: number;
  warning: number;
  pitchersFlagged: number;
  largestDropMph: number;
};

export function computeAlertStats(alerts: readonly PitchAlert[]): AlertStats {
  const pitchers = new Set<string>();
  let critical = 0;
  let warning = 0;
  let largestDrop = 0;
  for (const a of alerts) {
    pitchers.add(a.pitcher_id);
    if (a.severity === "critical") critical += 1;
    if (a.severity === "warning") warning += 1;
    if (a.delta_mph !== null) largestDrop = Math.max(largestDrop, -a.delta_mph);
  }
  return {
    count: alerts.length,
    critical,
    warning,
    pitchersFlagged: pitchers.size,
    largestDropMph: largestDrop,
  };
}
