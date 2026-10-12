// Row shapes mirror supabase/migrations. Keep them in sync when the schema changes.

export type ZoneEval = "IN ZONE" | "OUT OF ZONE" | "Unknown";

export type Pitch = {
  id: number;
  unique_id: string;
  game_id: number | null;
  pitch_type: string;
  speed_mph: number | null;
  zone_x: number | null;
  zone_z: number | null;
  zone_eval: ZoneEval;
  pitcher_id: string | null;
  pitcher_full_name: string;
  pitcher_team: string | null;
  inning: number | null;
  timestamp: string | null;
  created_at: string;
};

export type PitchAlert = {
  id: number;
  unique_id: string;
  pitch_unique_id: string | null;
  game_id: number | null;
  pitcher_id: string;
  pitcher_name: string | null;
  team: string | null;
  pitch_type: string | null;
  alert_type: string;
  message: string;
  severity: "info" | "warning" | "critical";
  baseline_mph: number | null;
  recent_mph: number | null;
  delta_mph: number | null;
  created_at: string;
};

export type PitchTypeStats = {
  pitchType: string;
  count: number;
  avgVelocity: number;
};

export type PitchStats = {
  count: number;
  maxVelocity: number;
  avgVelocity: number;
  inZone: number;
  zonePercentage: number;
  byType: PitchTypeStats[];
};

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";
