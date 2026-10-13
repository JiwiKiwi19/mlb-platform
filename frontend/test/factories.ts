import type { Pitch, PitchAlert } from "@/lib/types";

let seq = 0;

export function makePitch(overrides: Partial<Pitch> = {}): Pitch {
  seq += 1;
  return {
    id: seq,
    unique_id: `pitch-${seq}`,
    game_id: 1,
    pitch_type: "Four-Seam Fastball",
    speed_mph: 95,
    zone_x: 0,
    zone_z: 2.5,
    zone_eval: "IN ZONE",
    pitcher_id: "592332",
    pitcher_full_name: "Kevin Gausman",
    pitcher_team: "TOR",
    inning: 1,
    timestamp: "2026-07-01T23:05:09.000Z",
    created_at: "2026-07-01T23:05:10.000Z",
    ...overrides,
  };
}

export function makeAlert(overrides: Partial<PitchAlert> = {}): PitchAlert {
  seq += 1;
  return {
    id: seq,
    unique_id: `fatigue:pitch-${seq}`,
    pitch_unique_id: `pitch-${seq}`,
    game_id: 1,
    pitcher_id: "592332",
    pitcher_name: "Kevin Gausman",
    team: "TOR",
    pitch_type: "Four-Seam Fastball",
    alert_type: "Fatigue Risk",
    message: "Four-Seam Fastball velo down 1.8 mph (95.0 → 93.2)",
    severity: "warning",
    baseline_mph: 95,
    recent_mph: 93.2,
    delta_mph: -1.8,
    created_at: "2026-07-01T23:40:00.000Z",
    ...overrides,
  };
}
