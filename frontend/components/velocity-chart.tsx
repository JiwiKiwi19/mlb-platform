"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Pitch } from "@/lib/types";

type ChartPoint = { idx: number; speed: number; type: string; pitcher: string };

const ACCENT = "oklch(0.72 0.16 195)";
const AXIS = "oklch(0.68 0.02 255)";

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-card">
      <p className="font-mono text-base font-semibold">
        {d.speed.toFixed(1)} <span className="text-xs text-muted-foreground">mph</span>
      </p>
      <p className="text-muted-foreground">
        {d.type} · {d.pitcher}
      </p>
    </div>
  );
}

export function VelocityChart({ pitches }: { pitches: readonly Pitch[] }) {
  const { data, domain } = useMemo(() => {
    // Input is newest-first; plot oldest → newest, skipping unmeasured pitches.
    const points: ChartPoint[] = [];
    for (let i = pitches.length - 1; i >= 0; i--) {
      const p = pitches[i];
      if (p.speed_mph === null) continue;
      points.push({ idx: points.length + 1, speed: p.speed_mph, type: p.pitch_type, pitcher: p.pitcher_full_name });
    }
    const speeds = points.map((d) => d.speed);
    const domain: [number, number] = speeds.length
      ? [Math.floor(Math.min(...speeds) - 3), Math.ceil(Math.max(...speeds) + 3)]
      : [70, 105];
    return { data: points, domain };
  }, [pitches]);

  if (data.length === 0) {
    return (
      <div className="flex h-80 w-full items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        Waiting for velocity data...
      </div>
    );
  }

  return (
    <div className="h-80 w-full" role="img" aria-label={`Velocity of the last ${data.length} pitches`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="velo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.5} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
          <XAxis dataKey="idx" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
          <YAxis domain={domain} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ stroke: "oklch(0.62 0.22 27)", strokeWidth: 1, strokeDasharray: "3 3" }}
            content={<ChartTooltip />}
          />
          {/* Animation replays on every streamed point; disable it for live data. */}
          <Area
            type="monotone"
            dataKey="speed"
            stroke={ACCENT}
            strokeWidth={2}
            fill="url(#velo)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
