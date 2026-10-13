import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AlertsBell, MarkAlertsSeen } from "@/components/live-alerts";
import { LiveAlertsProvider, liveAlertsReducer, useLiveAlerts } from "@/components/providers/live-alerts-provider";
import type { PitchAlert } from "@/lib/types";
import { fakeSupabase } from "@/test/fake-supabase";
import { makeAlert } from "@/test/factories";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/supabase/client", async () => {
  const { fakeSupabase } = await import("@/test/fake-supabase");
  return { getBrowserSupabase: () => fakeSupabase.client };
});

const TABLE = "pitch_alerts";

function Probe() {
  const { alerts, unseen } = useLiveAlerts();
  return (
    <div>
      <p data-testid="ids">{alerts.map((a) => a.unique_id).join(",")}</p>
      <p data-testid="unseen">{unseen}</p>
    </div>
  );
}

function setup(initial: PitchAlert[] = [], extra?: React.ReactNode) {
  return render(
    <LiveAlertsProvider initialAlerts={initial}>
      <Probe />
      <AlertsBell />
      {extra}
    </LiveAlertsProvider>,
  );
}

const channel = () => fakeSupabase.channelFor(TABLE);
const unseen = () => screen.getByTestId("unseen").textContent;

beforeEach(() => fakeSupabase.reset());

describe("LiveAlertsProvider", () => {
  it("subscribes to pitch_alerts and renders server alerts without marking them unread", () => {
    setup([makeAlert({ unique_id: "ssr" })]);
    expect(channel().table).toBe(TABLE);
    expect(screen.getByTestId("ids")).toHaveTextContent("ssr");
    expect(unseen()).toBe("0");
    expect(screen.getByRole("link", { name: "Fatigue alerts" })).toHaveAttribute("href", "/alerts");
  });

  it("counts realtime alerts as unread and shows them on the bell", async () => {
    setup();
    act(() => {
      channel().emitInsert(makeAlert());
      channel().emitInsert(makeAlert());
    });
    await waitFor(() => expect(unseen()).toBe("2"));
    expect(screen.getByRole("link", { name: "Fatigue alerts, 2 new" })).toBeInTheDocument();
  });

  it("does not count backfilled catch-up alerts as unread", async () => {
    fakeSupabase.setBackfill(TABLE, [makeAlert({ unique_id: "missed" })]);
    setup();
    act(() => channel().emitStatus("SUBSCRIBED"));
    await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent("missed"));
    expect(unseen()).toBe("0");
  });

  it("does not double-count an alert that arrives twice", async () => {
    const alert = makeAlert();
    setup();
    act(() => channel().emitInsert(alert));
    await waitFor(() => expect(unseen()).toBe("1"));
    act(() => channel().emitInsert(alert));
    await new Promise((r) => requestAnimationFrame(r));
    expect(unseen()).toBe("1");
  });

  it("clears unread while the alerts page is mounted, including alerts that arrive meanwhile", async () => {
    setup([], <MarkAlertsSeen />);
    act(() => channel().emitInsert(makeAlert()));
    await waitFor(() => expect(screen.getByTestId("ids").textContent).not.toBe(""));
    expect(unseen()).toBe("0");
  });
});

describe("liveAlertsReducer", () => {
  it("returns the same state for no-op actions", () => {
    const state = { alerts: [makeAlert()], unseen: 0 };
    expect(liveAlertsReducer(state, { type: "markSeen" })).toBe(state);
    expect(liveAlertsReducer(state, { type: "merge", alerts: state.alerts, source: "realtime" })).toBe(state);
  });
});
