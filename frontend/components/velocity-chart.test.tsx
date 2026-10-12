import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VelocityChart } from "@/components/velocity-chart";
import { makePitch } from "@/test/factories";

describe("VelocityChart", () => {
  it("shows an empty state when no pitch has a measured speed", () => {
    render(<VelocityChart pitches={[makePitch({ speed_mph: null })]} />);
    expect(screen.getByText(/waiting for velocity data/i)).toBeInTheDocument();
  });

  it("plots only measured pitches", () => {
    render(<VelocityChart pitches={[makePitch(), makePitch({ speed_mph: null }), makePitch()]} />);
    expect(screen.getByRole("img", { name: "Velocity of the last 2 pitches" })).toBeInTheDocument();
  });
});
