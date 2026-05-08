"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Prevents Next.js Hydration crashes
function ClientTime({ timestamp }: { timestamp: string | null }) {
  const [timeString, setTimeString] = useState("--:--:--");
  useEffect(() => {
    if (!timestamp) return;
    setTimeString(
      new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    );
  }, [timestamp]);
  return <>{timeString}</>;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // IMPORTANT: Use ANON_KEY for Realtime subscriptions - SERVICE_KEY does NOT support Realtime
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export function PitchTable({ pitches: initialPitches }: { pitches: any[] }) {
  const [pitches, setPitches] = useState<any[]>(initialPitches || []);

  useEffect(() => {
    setPitches(initialPitches || []);

    const channel = supabase
      .channel("realtime-pitch-table")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_pitches" },
        (payload) => {
          setPitches((prev) => [payload.new, ...prev].slice(0, 50));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialPitches]);

  if (!pitches || pitches.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
        Waiting for stream data...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Pitcher</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3 text-right">Velo</th>
            <th className="px-4 py-3 text-right">Spin</th>
            <th className="px-4 py-3">Result</th>
          </tr>
        </thead>
        <tbody>
          {pitches.map((p, i) => {
            const hot = (p.speed_mph || 0) >= 96;
            const inZone = p.zone_eval?.includes("IN ZONE");

            return (
              <tr
                key={p.unique_id || i}
                className="border-b border-border/60 last:border-0 transition-colors hover:bg-secondary/30"
              >
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  <ClientTime timestamp={p.timestamp || p.created_at} />
                </td>
                <td className="px-4 py-3 font-medium">{p.pitcher_full_name}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-xs font-medium">
                    {p.pitch_type}
                  </span>
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono font-semibold ${hot ? "text-red-500" : ""}`}
                >
                  {p.speed_mph?.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                  {p.spin_rpm || "--"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                      inZone
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-secondary/60 text-muted-foreground"
                    }`}
                  >
                    {p.zone_eval}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
