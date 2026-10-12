"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { PITCH_COLUMNS, PITCH_WINDOW, computeStats, mergePitches, parsePitch, parsePitches } from "@/lib/pitches";
import type { ConnectionStatus, Pitch, PitchStats } from "@/lib/types";

type State = {
  pitches: Pitch[];
  status: ConnectionStatus;
};

type Action = { type: "merge"; pitches: Pitch[] } | { type: "status"; status: ConnectionStatus };

export function livePitchesReducer(state: State, action: Action): State {
  switch (action.type) {
    case "merge": {
      const pitches = mergePitches(state.pitches, action.pitches);
      return pitches === state.pitches ? state : { ...state, pitches };
    }
    case "status":
      return action.status === state.status ? state : { ...state, status: action.status };
  }
}

type LivePitchesValue = State & { stats: PitchStats };

const LivePitchesContext = createContext<LivePitchesValue | null>(null);

// Unique per mount: realtime-js returns an existing channel for a reused topic,
// which breaks StrictMode's mount → unmount → mount cycle.
let channelSeq = 0;

export function LivePitchesProvider({
  initialPitches,
  children,
}: {
  initialPitches: Pitch[];
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(livePitchesReducer, {
    pitches: initialPitches,
    status: "connecting",
  });
  const pending = useRef<Pitch[]>([]);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let active = true;

    // Coalesce bursts (a consumer batch commit can emit dozens of INSERTs) into one render per frame.
    const enqueue = (pitches: Pitch[]) => {
      pending.current.push(...pitches);
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const batch = pending.current;
        pending.current = [];
        if (active) dispatch({ type: "merge", pitches: batch });
      });
    };

    // Runs on every (re)subscribe to close the gap between SSR, disconnects, and live events.
    const backfill = async () => {
      const { data, error } = await supabase
        .from("live_pitches")
        .select(PITCH_COLUMNS)
        .order("id", { ascending: false })
        .limit(PITCH_WINDOW);
      if (!active) return;
      if (error) {
        console.warn("[live-pitches] backfill failed", error.message);
        return;
      }
      enqueue(parsePitches(data));
    };

    const channel = supabase
      .channel(`live-pitches:${++channelSeq}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_pitches" },
        (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
          const pitch = parsePitch(payload.new);
          if (pitch) enqueue([pitch]);
        },
      )
      .subscribe((status) => {
        if (!active) return;
        switch (status) {
          case "SUBSCRIBED":
            dispatch({ type: "status", status: "live" });
            void backfill();
            break;
          case "CHANNEL_ERROR":
          case "TIMED_OUT":
            dispatch({ type: "status", status: "reconnecting" });
            break;
          case "CLOSED":
            dispatch({ type: "status", status: "offline" });
            break;
        }
      });

    return () => {
      active = false;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      pending.current = [];
      void supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(() => computeStats(state.pitches), [state.pitches]);
  const value = useMemo(() => ({ ...state, stats }), [state, stats]);

  return <LivePitchesContext.Provider value={value}>{children}</LivePitchesContext.Provider>;
}

export function useLivePitches(): LivePitchesValue {
  const value = useContext(LivePitchesContext);
  if (!value) throw new Error("useLivePitches must be used inside <LivePitchesProvider>");
  return value;
}
