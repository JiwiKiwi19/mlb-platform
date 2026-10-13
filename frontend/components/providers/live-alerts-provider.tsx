"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import { useRealtimeInserts, type RowSource } from "@/hooks/use-realtime-inserts";
import { ALERT_COLUMNS, ALERT_WINDOW, computeAlertStats, countNew, mergeAlerts, parseAlert } from "@/lib/alerts";
import type { AlertStats } from "@/lib/alerts";
import type { PitchAlert } from "@/lib/types";

type State = {
  alerts: PitchAlert[];
  /** Alerts that arrived live since the user last looked at the alerts page. */
  unseen: number;
};

type Action = { type: "merge"; alerts: PitchAlert[]; source: RowSource } | { type: "markSeen" };

export function liveAlertsReducer(state: State, action: Action): State {
  switch (action.type) {
    case "merge": {
      const alerts = mergeAlerts(state.alerts, action.alerts);
      if (alerts === state.alerts) return state;
      // Backfilled rows are catch-up after (re)connecting, not news; only realtime inserts are unread.
      const added = action.source === "realtime" ? countNew(state.alerts, action.alerts) : 0;
      return { alerts, unseen: state.unseen + added };
    }
    case "markSeen":
      return state.unseen === 0 ? state : { ...state, unseen: 0 };
  }
}

type LiveAlertsValue = State & { stats: AlertStats; markSeen: () => void };

const LiveAlertsContext = createContext<LiveAlertsValue | null>(null);

export function LiveAlertsProvider({ initialAlerts, children }: { initialAlerts: PitchAlert[]; children: ReactNode }) {
  const [state, dispatch] = useReducer(liveAlertsReducer, { alerts: initialAlerts, unseen: 0 });

  useRealtimeInserts({
    table: "pitch_alerts",
    columns: ALERT_COLUMNS,
    limit: ALERT_WINDOW,
    parse: parseAlert,
    onRows: useCallback((alerts: PitchAlert[], source: RowSource) => dispatch({ type: "merge", alerts, source }), []),
  });

  const markSeen = useCallback(() => dispatch({ type: "markSeen" }), []);
  const stats = useMemo(() => computeAlertStats(state.alerts), [state.alerts]);
  const value = useMemo(() => ({ ...state, stats, markSeen }), [state, stats, markSeen]);

  return <LiveAlertsContext.Provider value={value}>{children}</LiveAlertsContext.Provider>;
}

export function useLiveAlerts(): LiveAlertsValue {
  const value = useContext(LiveAlertsContext);
  if (!value) throw new Error("useLiveAlerts must be used inside <LiveAlertsProvider>");
  return value;
}
