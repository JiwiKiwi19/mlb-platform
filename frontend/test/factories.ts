import type { Pitch } from "@/lib/types";

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
