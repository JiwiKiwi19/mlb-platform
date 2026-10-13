"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import { useRealtimeInserts } from "@/hooks/use-realtime-inserts";
import { PITCH_COLUMNS, PITCH_WINDOW, computeStats, mergePitches, parsePitch } from "@/lib/pitches";
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

export function LivePitchesProvider({ initialPitches, children }: { initialPitches: Pitch[]; children: ReactNode }) {
  const [state, dispatch] = useReducer(livePitchesReducer, {
    pitches: initialPitches,
    status: "connecting",
  });

  useRealtimeInserts({
    table: "live_pitches",
    columns: PITCH_COLUMNS,
    limit: PITCH_WINDOW,
    parse: parsePitch,
    onRows: useCallback((pitches: Pitch[]) => dispatch({ type: "merge", pitches }), []),
    onStatus: useCallback((status: ConnectionStatus) => dispatch({ type: "status", status }), []),
  });

  const stats = useMemo(() => computeStats(state.pitches), [state.pitches]);
  const value = useMemo(() => ({ ...state, stats }), [state, stats]);

  return <LivePitchesContext.Provider value={value}>{children}</LivePitchesContext.Provider>;
}

export function useLivePitches(): LivePitchesValue {
  const value = useContext(LivePitchesContext);
  if (!value) throw new Error("useLivePitches must be used inside <LivePitchesProvider>");
  return value;
}
