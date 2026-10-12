import { describe, expect, it } from "vitest";
import { computeStats, formatPitchTime, mergePitches, parsePitch, parsePitches } from "@/lib/pitches";
import { makePitch } from "@/test/factories";

describe("parsePitch", () => {
  const row = {
    id: 7,
    unique_id: "745123_10_3",
    game_id: 745123,
    pitch_type: "Slider",
    speed_mph: 86.4,
    zone_x: "0.1", // numeric columns can arrive as strings
    zone_z: 2.2,
    zone_eval: "OUT OF ZONE",
    pitcher_id: "592332",
    pitcher_full_name: "Kevin Gausman",
    pitcher_team: "TOR",
    inning: null,
    timestamp: null,
    created_at: "2026-07-01T23:05:10Z",
    extra_column: "ignored",
  };

  it("narrows a valid row", () => {
    expect(parsePitch(row)).toEqual({
      id: 7,
      unique_id: "745123_10_3",
      game_id: 745123,
      pitch_type: "Slider",
      speed_mph: 86.4,
      zone_x: 0.1,
      zone_z: 2.2,
      zone_eval: "OUT OF ZONE",
      pitcher_id: "592332",
      pitcher_full_name: "Kevin Gausman",
      pitcher_team: "TOR",
      inning: null,
      timestamp: null,
      created_at: "2026-07-01T23:05:10Z",
    });
  });

  it.each([null, undefined, 42, "row", {}, { ...row, id: undefined }, { ...row, unique_id: 5 }])(
    "rejects %j",
    (bad) => {
      expect(parsePitch(bad)).toBeNull();
    },
  );

  it("defaults unknown enums and missing labels", () => {
    const parsed = parsePitch({ ...row, zone_eval: "MAYBE", pitch_type: null, pitcher_full_name: undefined });
    expect(parsed).toMatchObject({ zone_eval: "Unknown", pitch_type: "Unknown", pitcher_full_name: "Unknown" });
  });

  it("drops invalid rows from a list", () => {
    expect(parsePitches([row, null, { nope: true }])).toHaveLength(1);
    expect(parsePitches(null)).toEqual([]);
  });
});

describe("mergePitches", () => {
  it("prepends new pitches newest-first by insertion id", () => {
    const a = makePitch({ id: 1 });
    const b = makePitch({ id: 2 });
    const c = makePitch({ id: 3 });
    expect(mergePitches([b, a], [c]).map((p) => p.id)).toEqual([3, 2, 1]);
  });

  it("orders a backfill that arrives out of order", () => {
    const pitches = [3, 1, 2].map((id) => makePitch({ id }));
    expect(mergePitches([], pitches).map((p) => p.id)).toEqual([3, 2, 1]);
  });

  it("deduplicates by unique_id", () => {
    const a = makePitch({ id: 1, unique_id: "x" });
    const merged = mergePitches([a], [makePitch({ id: 1, unique_id: "x", speed_mph: 97 })]);
    expect(merged).toHaveLength(1);
    expect(merged[0].speed_mph).toBe(97);
  });

  it("caps the window to bound memory in long sessions", () => {
    let list = [makePitch()];
    for (let i = 0; i < 500; i++) list = mergePitches(list, [makePitch()], 50);
    expect(list).toHaveLength(50);
    expect(list[0].id).toBeGreaterThan(list[49].id);
  });

  it("returns the same array when nothing changed so React can bail out", () => {
    const a = makePitch();
    const current = [a];
    expect(mergePitches(current, [])).toBe(current);
    expect(mergePitches(current, [a])).toBe(current);
  });
});

describe("computeStats", () => {
  it("handles an empty window", () => {
    expect(computeStats([])).toEqual({
      count: 0,
      maxVelocity: 0,
      avgVelocity: 0,
      inZone: 0,
      zonePercentage: 0,
      byType: [],
    });
  });

  it("computes velocity, zone, and per-type stats, ignoring unmeasured speeds", () => {
    const stats = computeStats([
      makePitch({ speed_mph: 96, zone_eval: "IN ZONE" }),
      makePitch({ speed_mph: 94, zone_eval: "OUT OF ZONE" }),
      makePitch({ speed_mph: null, zone_eval: "IN ZONE" }),
      makePitch({ pitch_type: "Slider", speed_mph: 85, zone_eval: "Unknown" }),
    ]);
    expect(stats.count).toBe(4);
    expect(stats.maxVelocity).toBe(96);
    expect(stats.avgVelocity).toBeCloseTo((96 + 94 + 85) / 3);
    expect(stats.inZone).toBe(2);
    expect(stats.zonePercentage).toBe(50);
    expect(stats.byType).toEqual([
      { pitchType: "Four-Seam Fastball", count: 3, avgVelocity: 95 },
      { pitchType: "Slider", count: 1, avgVelocity: 85 },
    ]);
  });
});

describe("formatPitchTime", () => {
  it("formats in Eastern time regardless of the runtime time zone", () => {
    expect(formatPitchTime("2026-07-01T23:05:09Z")).toBe("19:05:09");
  });

  it("falls back for missing or invalid input", () => {
    expect(formatPitchTime(null)).toBe("--:--:--");
    expect(formatPitchTime("not a date")).toBe("--:--:--");
  });
});
