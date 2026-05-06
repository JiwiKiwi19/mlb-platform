"use client";
import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface PitchTableProps {
  pitches: any[];
}

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

export function PitchTable({ pitches: initialPitches }: PitchTableProps) {
  const [pitches, setPitches] = useState<any[]>(initialPitches);

  useEffect(() => {
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
  }, []);

  if (!pitches || pitches.length === 0) {
    return <div className="empty-state">Waiting for stream data...</div>;
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Pitcher</th>
            <th>Type</th>
            <th>Velo (MPH)</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {pitches.map((pitch) => {
            const isInZone = pitch.zone_eval?.includes("IN ZONE");
            return (
              <tr key={pitch.unique_id ?? pitch.id}>
                <td className="table-time">
                  <ClientTime timestamp={pitch.timestamp} />
                </td>
                <td className="table-pitcher">
                  {pitch.pitcher_full_name || "Unknown Pitcher"}
                </td>
                <td>
                  <span className="table-type-pill">
                    {pitch.pitch_type || "Unknown"}
                  </span>
                </td>
                <td>
                  <span
                    className={`table-velo ${pitch.speed_mph > 95 ? "table-velo-hot" : ""}`}
                  >
                    {pitch.speed_mph ? pitch.speed_mph.toFixed(1) : "--"}
                  </span>
                </td>
                <td>
                  {isInZone ? (
                    <span className="table-zone-badge in">In Zone</span>
                  ) : (
                    <span className="table-zone-badge out">Ball</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
