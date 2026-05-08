"use client";

import React, { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // IMPORTANT: Use ANON_KEY for Realtime subscriptions - SERVICE_KEY does NOT support Realtime
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export function VelocityChart({ pitches: initialPitches }: { pitches: any[] }) {
  const [pitches, setPitches] = useState<any[]>(initialPitches || []);

  useEffect(() => {
    setPitches(initialPitches || []);

    const channel = supabase
      .channel("realtime-velocity-chart")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_pitches" },
        (payload) => {
          setPitches((current) => {
            const next = [payload.new, ...current];
            return next.slice(0, 50);
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialPitches]);

  const chartData = useMemo(() => {
    return [...pitches].reverse().map((p, i) => ({
      idx: i + 1,
      speed: p.speed_mph || 0,
      type: p.pitch_type || "Unknown",
      pitcher: p.pitcher_full_name || "Unknown",
    }));
  }, [pitches]);

  const speeds = chartData.map((d) => d.speed).filter((s) => s > 0);
  const min = speeds.length ? Math.floor(Math.min(...speeds) - 3) : 70;
  const max = speeds.length ? Math.ceil(Math.max(...speeds) + 3) : 105;

  if (!pitches || pitches.length === 0) {
    return (
      <div className="h-[320px] w-full flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
        Waiting for velocity data...
      </div>
    );
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 12, left: -10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="velo" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="oklch(0.72 0.16 195)"
                stopOpacity={0.5}
              />
              <stop
                offset="100%"
                stopColor="oklch(0.72 0.16 195)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
          <XAxis
            dataKey="idx"
            stroke="oklch(0.68 0.02 255)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[min, max]}
            stroke="oklch(0.68 0.02 255)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip
            cursor={{
              stroke: "oklch(0.62 0.22 27)",
              strokeWidth: 1,
              strokeDasharray: "3 3",
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-card">
                  <p className="font-mono text-base font-semibold">
                    {d.speed}{" "}
                    <span className="text-xs text-muted-foreground">mph</span>
                  </p>
                  <p className="text-muted-foreground">
                    {d.type} · {d.pitcher}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="speed"
            stroke="oklch(0.72 0.16 195)"
            strokeWidth={2}
            fill="url(#velo)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
