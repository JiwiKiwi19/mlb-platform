import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StrikeZone } from "@/components/strike-zone";
import { makePitch } from "@/test/factories";

describe("StrikeZone", () => {
  it("highlights the first (newest) pitch and fades the rest", () => {
    const newest = makePitch({ zone_x: 0.5, zone_z: 3.0 });
    const older = makePitch({ zone_x: -0.5, zone_z: 2.0 });
    render(<StrikeZone pitches={[newest, older]} />);

    const latest = screen.getByTestId("latest-pitch-dot");
    const history = screen.getAllByTestId("pitch-dot");
    expect(history).toHaveLength(1);
    // newest is right of center (x = 0.5) and higher (z = 3.0) than the older dot.
    expect(Number(latest.getAttribute("cx"))).toBeGreaterThan(Number(history[0].getAttribute("cx")));
    expect(Number(latest.getAttribute("cy"))).toBeLessThan(Number(history[0].getAttribute("cy")));
  });

  it("colours strikes and balls differently", () => {
    render(<StrikeZone pitches={[makePitch({ zone_eval: "IN ZONE" }), makePitch({ zone_eval: "OUT OF ZONE" })]} />);
    expect(screen.getByTestId("latest-pitch-dot").getAttribute("fill")).not.toBe(
      screen.getByTestId("pitch-dot").getAttribute("fill"),
    );
  });

  it("skips pitches without a location instead of plotting them at the origin", () => {
    render(<StrikeZone pitches={[makePitch({ zone_x: null }), makePitch({ zone_z: null }), makePitch()]} />);
    expect(screen.queryByTestId("latest-pitch-dot")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("pitch-dot")).toHaveLength(1);
  });

  it("renders an empty zone", () => {
    render(<StrikeZone pitches={[]} />);
    expect(screen.getByRole("img", { name: /0 pitch locations/ })).toBeInTheDocument();
  });
});
