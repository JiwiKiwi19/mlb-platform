import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AlertList } from "@/components/alert-list";
import { makeAlert } from "@/test/factories";

describe("AlertList", () => {
  it("shows an empty state", () => {
    render(<AlertList alerts={[]} />);
    expect(screen.getByText(/no fatigue alerts yet/i)).toBeInTheDocument();
  });

  it("renders each alert with severity, pitcher, time, and velocity detail", () => {
    render(
      <AlertList
        alerts={[
          makeAlert({ severity: "critical", pitcher_name: "José Berríos", delta_mph: -3.1 }),
          makeAlert({ pitcher_name: null, pitcher_id: "42", baseline_mph: null }),
        ]}
      />,
    );

    const items = within(screen.getByRole("list", { name: "Fatigue alerts" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    const first = within(items[0]);
    expect(first.getByText("José Berríos")).toBeInTheDocument();
    expect(first.getByText("Critical")).toBeInTheDocument();
    expect(first.getByText("19:40:00 ET")).toBeInTheDocument();
    expect(first.getByText(/baseline 95.0 → recent 93.2 mph/)).toBeInTheDocument();
    expect(first.getByText("-3.1")).toBeInTheDocument();

    const second = within(items[1]);
    expect(second.getByText("Pitcher 42")).toBeInTheDocument();
    expect(second.queryByText(/baseline/)).not.toBeInTheDocument();
  });
});
