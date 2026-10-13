"use client";

import { useEffect, useRef } from "react";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { parseRows } from "@/lib/rows";
import type { ConnectionStatus } from "@/lib/types";

export type RowSource = "backfill" | "realtime";

export type RealtimeInsertsOptions<T> = {
  table: string;
  /** Explicit select list used for backfills. */
  columns: string;
  /** Rows to backfill, newest first by id. */
  limit: number;
  parse: (row: unknown) => T | null;
  /** Called at most once per animation frame per source, never after unmount. */
  onRows: (rows: T[], source: RowSource) => void;
  onStatus?: (status: ConnectionStatus) => void;
};

// Unique per mount: realtime-js returns an existing channel for a reused topic,
// which breaks StrictMode's mount → unmount → mount cycle.
let channelSeq = 0;

/**
 * The single place the dashboard opens Supabase Realtime channels.
 *
 * - backfills the latest rows on every (re)subscribe, closing the gap between the
 *   server render, disconnects, and live events
 * - coalesces bursts (a consumer batch commit can emit dozens of INSERTs) into one
 *   callback per frame
 * - maps channel states to ConnectionStatus and tears everything down on unmount
 */
export function useRealtimeInserts<T>(options: RealtimeInsertsOptions<T>): void {
  // Callbacks change identity every render; read them through a ref so the
  // subscription is only rebuilt when the table/query actually changes.
  const latest = useRef(options);
  latest.current = options;

  const { table, columns, limit } = options;

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let active = true;
    let frame: number | null = null;
    const pending: Record<RowSource, T[]> = { backfill: [], realtime: [] };

    const flush = () => {
      frame = null;
      if (!active) return;
      for (const source of ["backfill", "realtime"] as const) {
        const rows = pending[source];
        pending[source] = [];
        if (rows.length) latest.current.onRows(rows, source);
      }
    };

    const enqueue = (rows: T[], source: RowSource) => {
      pending[source].push(...rows);
      if (frame === null) frame = requestAnimationFrame(flush);
    };

    const setStatus = (status: ConnectionStatus) => latest.current.onStatus?.(status);

    const backfill = async () => {
      const { data, error } = await supabase.from(table).select(columns).order("id", { ascending: false }).limit(limit);
      if (!active) return;
      if (error) {
        console.warn(`[realtime:${table}] backfill failed`, error.message);
        return;
      }
      enqueue(parseRows(data, latest.current.parse), "backfill");
    };

    const channel = supabase
      .channel(`${table}:${++channelSeq}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table },
        (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
          const row = latest.current.parse(payload.new);
          if (row) enqueue([row], "realtime");
        },
      )
      .subscribe((status) => {
        if (!active) return;
        switch (status) {
          case "SUBSCRIBED":
            setStatus("live");
            void backfill();
            break;
          case "CHANNEL_ERROR":
          case "TIMED_OUT":
            setStatus("reconnecting");
            break;
          case "CLOSED":
            setStatus("offline");
            break;
        }
      });

    return () => {
      active = false;
      if (frame !== null) cancelAnimationFrame(frame);
      void supabase.removeChannel(channel);
    };
  }, [table, columns, limit]);
}
