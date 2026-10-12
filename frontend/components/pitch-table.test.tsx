import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PitchTable } from "@/components/pitch-table";
import { makePitch } from "@/test/factories";

describe("PitchTable", () => {
  it("shows an empty state", () => {
    render(<PitchTable pitches={[]} />);
    expect(screen.getByText(/waiting for stream data/i)).toBeInTheDocument();
  });

  it("renders one row per pitch with formatted values", () => {
    render(
      <PitchTable
        pitches={[
          makePitch({ speed_mph: 97.24, inning: 7, zone_eval: "IN ZONE", timestamp: "2026-07-01T23:05:09Z" }),
          makePitch({ pitcher_full_name: "José Berríos", speed_mph: null, inning: null, zone_eval: "OUT OF ZONE" }),
        ]}
      />,
    );

    const rows = screen.getAllByRole("row").slice(1); // skip header
    expect(rows).toHaveLength(2);

    const first = within(rows[0]);
    expect(first.getByText("19:05:09")).toBeInTheDocument();
    expect(first.getByText("97.2")).toHaveClass("text-red-500"); // ≥ 96 mph is highlighted
    expect(first.getByText("7")).toBeInTheDocument();
    expect(first.getByText("IN ZONE")).toBeInTheDocument();

    const second = within(rows[1]);
    expect(second.getByText("José Berríos")).toBeInTheDocument();
    expect(second.getAllByText("--")).toHaveLength(2); // unmeasured speed and inning
    expect(second.getByText("OUT OF ZONE")).toBeInTheDocument();
  });
});
