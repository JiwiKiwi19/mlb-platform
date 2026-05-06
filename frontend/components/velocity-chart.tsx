"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type VelocityChartProps = {
  pitches: any[];
};

export function VelocityChart({ pitches }: VelocityChartProps) {
  // FIX 1: Prevent "Hydration" errors by waiting for the component to mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !pitches || pitches.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted">
        Loading chart...
      </div>
    );
  }

  const chartData = [...pitches].reverse().map((p, index) => ({
    name: `Pitch ${index + 1}`,
    speed: p.speed_mph,
    type: p.pitch_type,
    zone: p.zone_eval,
  }));

  const speeds = chartData.map((d) => d.speed).filter((s) => s > 0);
  const minSpeed = speeds.length ? Math.floor(Math.min(...speeds) - 5) : 70;
  const maxSpeed = speeds.length ? Math.ceil(Math.max(...speeds) + 5) : 105;

  return (
    // FIX 2: Ensure the parent div has a fixed height and width
    <div style={{ width: "100%", height: 300, minHeight: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(148, 163, 184, 0.1)"
            vertical={false}
          />
          <XAxis dataKey="name" hide />
          <YAxis
            domain={[minSpeed, maxSpeed]}
            stroke="#8ea3c3"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="stat-tooltip">
                    <strong>{data.speed} mph</strong>
                    <p>{data.type}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="speed"
            stroke="#34d399"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorSpeed)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
