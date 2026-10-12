import { act, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pitch } from "@/lib/types";
import { makePitch } from "@/test/factories";

// ---- fake Supabase client -------------------------------------------------

type StatusCallback = (status: string) => void;
type InsertHandler = (payload: { new: unknown }) => void;

class FakeChannel {
  insertHandler?: InsertHandler;
  statusCallback?: StatusCallback;
  constructor(public name: string) {}
  on(_event: string, _filter: unknown, handler: InsertHandler) {
    this.insertHandler = handler;
    return this;
  }
  subscribe(cb: StatusCallback) {
    this.statusCallback = cb;
    return this;
  }
}

const fake = {
  channels: [] as FakeChannel[],
  removed: [] as FakeChannel[],
  backfillRows: [] as Pitch[],
  backfillCalls: 0,
};

const fakeClient = {
  channel: (name: string) => {
    const ch = new FakeChannel(name);
    fake.channels.push(ch);
    return ch;
  },
  removeChannel: async (ch: FakeChannel) => {
    fake.removed.push(ch);
    return "ok";
  },
  from: () => ({
    select: () => ({
      order: () => ({
        limit: async () => {
          fake.backfillCalls += 1;
          return { data: fake.backfillRows, error: null };
        },
      }),
    }),
  }),
};

vi.mock("@/lib/supabase/client", () => ({ getBrowserSupabase: () => fakeClient }));

// Imported after the mock is registered.
const { LivePitchesProvider, useLivePitches, livePitchesReducer } =
  await import("@/components/providers/live-pitches-provider");

// ---- helpers --------------------------------------------------------------

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

const channel = () => fake.channels[fake.channels.length - 1];
const ids = () => screen.getByTestId("ids").textContent;

function setup(initial: Pitch[] = []) {
  return render(
    <LivePitchesProvider initialPitches={initial}>
      <Probe />
    </LivePitchesProvider>,
  );
}

beforeEach(() => {
  fake.channels = [];
  fake.removed = [];
  fake.backfillRows = [];
  fake.backfillCalls = 0;
  renders = 0;
});

afterEach(() => vi.restoreAllMocks());

// ---- tests ----------------------------------------------------------------

describe("LivePitchesProvider", () => {
  it("renders server-provided pitches immediately and starts connecting", () => {
    setup([makePitch({ unique_id: "a", id: 2 }), makePitch({ unique_id: "b", id: 1 })]);
    expect(ids()).toBe("a,b");
    expect(screen.getByTestId("status")).toHaveTextContent("connecting");
  });

  it("goes live and backfills on subscribe", async () => {
    fake.backfillRows = [makePitch({ unique_id: "missed", id: 10 })];
    setup([makePitch({ unique_id: "ssr", id: 1 })]);

    act(() => channel().statusCallback?.("SUBSCRIBED"));

    expect(screen.getByTestId("status")).toHaveTextContent("live");
    await waitFor(() => expect(ids()).toBe("missed,ssr"));
    expect(fake.backfillCalls).toBe(1);
  });

  it("prepends realtime inserts and ignores malformed payloads", async () => {
    setup([makePitch({ unique_id: "old", id: 1 })]);

    act(() => {
      channel().insertHandler?.({ new: makePitch({ unique_id: "new", id: 2 }) });
      channel().insertHandler?.({ new: { garbage: true } });
    });

    await waitFor(() => expect(ids()).toBe("new,old"));
  });

  it("coalesces a burst of inserts into a single render", async () => {
    setup();
    const before = renders;

    act(() => {
      for (let i = 1; i <= 100; i++) channel().insertHandler?.({ new: makePitch({ id: i }) });
    });

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("50"));
    expect(renders - before).toBe(1);
  });

  it("deduplicates a pitch delivered by both backfill and realtime", async () => {
    const pitch = makePitch({ unique_id: "dup", id: 5 });
    fake.backfillRows = [pitch];
    setup();

    act(() => {
      channel().insertHandler?.({ new: pitch });
      channel().statusCallback?.("SUBSCRIBED");
    });

    await waitFor(() => expect(fake.backfillCalls).toBe(1));
    await waitFor(() => expect(ids()).toBe("dup"));
  });

  it.each([
    ["CHANNEL_ERROR", "reconnecting"],
    ["TIMED_OUT", "reconnecting"],
    ["CLOSED", "offline"],
  ])("maps %s to %s", (raw, expected) => {
    setup();
    act(() => channel().statusCallback?.(raw));
    expect(screen.getByTestId("status")).toHaveTextContent(expected);
  });

  it("backfills again after a reconnect", async () => {
    setup();
    act(() => channel().statusCallback?.("SUBSCRIBED"));
    act(() => channel().statusCallback?.("CHANNEL_ERROR"));
    act(() => channel().statusCallback?.("SUBSCRIBED"));
    await waitFor(() => expect(fake.backfillCalls).toBe(2));
  });

  it("removes its channel on unmount and ignores late events", async () => {
    const { unmount } = setup();
    const ch = channel();
    unmount();

    expect(fake.removed).toContain(ch);
    // A late status callback after unmount must not throw or update state.
    expect(() => ch.statusCallback?.("SUBSCRIBED")).not.toThrow();
    expect(fake.backfillCalls).toBe(0);
  });

  it("uses a fresh channel name on every mount (StrictMode double-mount)", () => {
    render(
      <StrictMode>
        <LivePitchesProvider initialPitches={[]}>
          <Probe />
        </LivePitchesProvider>
      </StrictMode>,
    );
    expect(fake.channels).toHaveLength(2);
    expect(fake.removed).toEqual([fake.channels[0]]);
    expect(new Set(fake.channels.map((c) => c.name)).size).toBe(2);
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
