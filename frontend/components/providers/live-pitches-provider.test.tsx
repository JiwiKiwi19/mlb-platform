import { act, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LivePitchesProvider, livePitchesReducer, useLivePitches } from "@/components/providers/live-pitches-provider";
import type { Pitch } from "@/lib/types";
import { fakeSupabase } from "@/test/fake-supabase";
import { makePitch } from "@/test/factories";

vi.mock("@/lib/supabase/client", async () => {
  const { fakeSupabase } = await import("@/test/fake-supabase");
  return { getBrowserSupabase: () => fakeSupabase.client };
});

const TABLE = "live_pitches";
let renders = 0;

function Probe() {
  const { pitches, status, stats } = useLivePitches();
  renders += 1;
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="ids">{pitches.map((p) => p.unique_id).join(",")}</p>
      <p data-testid="count">{stats.count}</p>
    </div>
  );
}

const channel = () => fakeSupabase.channelFor(TABLE);
const ids = () => screen.getByTestId("ids").textContent;
const backfills = () => fakeSupabase.backfillCalls[TABLE] ?? 0;

function setup(initial: Pitch[] = []) {
  return render(
    <LivePitchesProvider initialPitches={initial}>
      <Probe />
    </LivePitchesProvider>,
  );
}

beforeEach(() => {
  fakeSupabase.reset();
  renders = 0;
});

afterEach(() => vi.restoreAllMocks());

describe("LivePitchesProvider", () => {
  it("renders server-provided pitches immediately and starts connecting", () => {
    setup([makePitch({ unique_id: "a", id: 2 }), makePitch({ unique_id: "b", id: 1 })]);
    expect(ids()).toBe("a,b");
    expect(screen.getByTestId("status")).toHaveTextContent("connecting");
  });

  it("goes live and backfills on subscribe", async () => {
    fakeSupabase.setBackfill(TABLE, [makePitch({ unique_id: "missed", id: 10 })]);
    setup([makePitch({ unique_id: "ssr", id: 1 })]);

    act(() => channel().emitStatus("SUBSCRIBED"));

    expect(screen.getByTestId("status")).toHaveTextContent("live");
    await waitFor(() => expect(ids()).toBe("missed,ssr"));
    expect(backfills()).toBe(1);
  });

  it("prepends realtime inserts and ignores malformed payloads", async () => {
    setup([makePitch({ unique_id: "old", id: 1 })]);

    act(() => {
      channel().emitInsert(makePitch({ unique_id: "new", id: 2 }));
      channel().emitInsert({ garbage: true });
    });

    await waitFor(() => expect(ids()).toBe("new,old"));
  });

  it("coalesces a burst of inserts into a single render", async () => {
    setup();
    const before = renders;

    act(() => {
      for (let i = 1; i <= 100; i++) channel().emitInsert(makePitch({ id: i }));
    });

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("50"));
    expect(renders - before).toBe(1);
  });

  it("deduplicates a pitch delivered by both backfill and realtime", async () => {
    const pitch = makePitch({ unique_id: "dup", id: 5 });
    fakeSupabase.setBackfill(TABLE, [pitch]);
    setup();

    act(() => {
      channel().emitInsert(pitch);
      channel().emitStatus("SUBSCRIBED");
    });

    await waitFor(() => expect(backfills()).toBe(1));
    await waitFor(() => expect(ids()).toBe("dup"));
  });

  it.each([
    ["CHANNEL_ERROR", "reconnecting"],
    ["TIMED_OUT", "reconnecting"],
    ["CLOSED", "offline"],
  ] as const)("maps %s to %s", (raw, expected) => {
    setup();
    act(() => channel().emitStatus(raw));
    expect(screen.getByTestId("status")).toHaveTextContent(expected);
  });

  it("backfills again after a reconnect", async () => {
    setup();
    act(() => channel().emitStatus("SUBSCRIBED"));
    act(() => channel().emitStatus("CHANNEL_ERROR"));
    act(() => channel().emitStatus("SUBSCRIBED"));
    await waitFor(() => expect(backfills()).toBe(2));
  });

  it("removes its channel on unmount and ignores late events", () => {
    const { unmount } = setup();
    const ch = channel();
    unmount();

    expect(fakeSupabase.removed).toContain(ch);
    expect(() => ch.emitStatus("SUBSCRIBED")).not.toThrow();
    expect(backfills()).toBe(0);
  });

  it("uses a fresh channel name on every mount (StrictMode double-mount)", () => {
    render(
      <StrictMode>
        <LivePitchesProvider initialPitches={[]}>
          <Probe />
        </LivePitchesProvider>
      </StrictMode>,
    );
    expect(fakeSupabase.channels).toHaveLength(2);
    expect(fakeSupabase.removed).toEqual([fakeSupabase.channels[0]]);
    expect(new Set(fakeSupabase.channels.map((c) => c.name)).size).toBe(2);
  });

  it("throws a clear error when used outside the provider", () => {
    // Silence React's error logging and jsdom's uncaught-error report for this expected throw.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const swallow = (e: ErrorEvent) => e.preventDefault();
    window.addEventListener("error", swallow);
    try {
      expect(() => render(<Probe />)).toThrow(/inside <LivePitchesProvider>/);
    } finally {
      window.removeEventListener("error", swallow);
    }
  });
});

describe("livePitchesReducer", () => {
  const state = { pitches: [makePitch()], status: "live" as const };

  it("returns the same state object for no-op actions", () => {
    expect(livePitchesReducer(state, { type: "status", status: "live" })).toBe(state);
    expect(livePitchesReducer(state, { type: "merge", pitches: [] })).toBe(state);
  });
});
