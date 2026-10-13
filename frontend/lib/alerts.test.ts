import { describe, expect, it } from "vitest";
import { computeAlertStats, countNew, mergeAlerts, parseAlert } from "@/lib/alerts";
import { makeAlert } from "@/test/factories";

describe("parseAlert", () => {
  // Shape the Python consumer writes (PitchAlert.to_row) plus DB-generated columns.
  const row = {
    id: 3,
    unique_id: "fatigue:745123_10_3",
    pitch_unique_id: "745123_10_3",
    game_id: 745123,
    pitcher_id: "592332",
    pitcher_name: "Kevin Gausman",
    team: "TOR",
    pitch_type: "Slider",
    alert_type: "Fatigue Risk",
    message: "Slider velo down 3.2 mph (86.0 → 82.8)",
    severity: "critical",
    baseline_mph: "86.0",
    recent_mph: 82.8,
    delta_mph: -3.2,
    created_at: "2026-07-01T23:40:00Z",
  };

  it("narrows a consumer-written row", () => {
    expect(parseAlert(row)).toMatchObject({ id: 3, severity: "critical", baseline_mph: 86, delta_mph: -3.2 });
  });

  it.each(["id", "unique_id", "pitcher_id", "message", "created_at"])("rejects rows missing %s", (field) => {
    expect(parseAlert({ ...row, [field]: undefined })).toBeNull();
  });

  it("tolerates rows from the pre-v1 consumer", () => {
    const legacy = { ...row, game_id: undefined, pitch_type: undefined, baseline_mph: null, severity: "loud" };
    expect(parseAlert(legacy)).toMatchObject({
      game_id: null,
      pitch_type: null,
      baseline_mph: null,
      severity: "warning",
    });
  });
});

describe("mergeAlerts / countNew", () => {
  it("keeps newest first, dedupes, and caps", () => {
    const old = makeAlert({ id: 1 });
    const merged = mergeAlerts([old], [makeAlert({ id: 3 }), makeAlert({ id: 2 }), old], 2);
    expect(merged.map((a) => a.id)).toEqual([3, 2]);
  });

  it("counts only alerts not already present", () => {
    const a = makeAlert();
    const b = makeAlert();
    expect(countNew([a], [a, b, b])).toBe(1);
  });
});

describe("computeAlertStats", () => {
  it("summarises severity, pitchers, and the largest drop", () => {
    expect(
      computeAlertStats([
        makeAlert({ severity: "critical", delta_mph: -3.4, pitcher_id: "1" }),
        makeAlert({ severity: "warning", delta_mph: -1.6, pitcher_id: "1" }),
        makeAlert({ severity: "warning", delta_mph: null, pitcher_id: "2" }),
      ]),
    ).toEqual({ count: 3, critical: 1, warning: 2, pitchersFlagged: 2, largestDropMph: 3.4 });
  });

  it("handles no alerts", () => {
    expect(computeAlertStats([])).toEqual({ count: 0, critical: 0, warning: 0, pitchersFlagged: 0, largestDropMph: 0 });
  });
});
