"use client";

// Realtime-connected widgets. Each reads from LivePitchesProvider and renders a
// presentational component, so pages stay server components.
// The velocity chart lives in live-velocity-chart.tsx so pages without it don't ship recharts.

import { Activity, Gauge, Hash, Target, TrendingUp, Zap } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { MetaItem } from "@/components/page-header";
import { PitchTable } from "@/components/pitch-table";
import { StrikeZone } from "@/components/strike-zone";
import { useLivePitches } from "@/components/providers/live-pitches-provider";
import type { PitchStats } from "@/lib/types";

export function LivePitchTable() {
  return <PitchTable pitches={useLivePitches().pitches} />;
}

export function LiveStrikeZone() {
  return <StrikeZone pitches={useLivePitches().pitches} />;
}

const mph = (v: number) => v.toFixed(1);

const META: Record<string, { label: string; value: (s: PitchStats) => string }> = {
  top: { label: "Top", value: (s) => `${mph(s.maxVelocity)} mph` },
  avg: { label: "Avg", value: (s) => `${mph(s.avgVelocity)} mph` },
  inZone: { label: "In Zone", value: (s) => `${s.inZone}/${s.count}` },
  zonePct: { label: "Zone %", value: (s) => `${s.zonePercentage.toFixed(1)}%` },
};

export function LiveMeta({ items }: { items: (keyof typeof META)[] }) {
  const { stats } = useLivePitches();
  return (
    <>
      {items.map((key) => (
        <MetaItem key={key} label={META[key].label} value={META[key].value(stats)} />
      ))}
    </>
  );
}

export function OverviewMetrics() {
  const { stats } = useLivePitches();
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Pitches Tracked" value={String(stats.count)} helper="rolling window" icon={Activity} />
      <MetricCard label="Top Velocity" value={mph(stats.maxVelocity)} unit="mph" helper="window max" icon={Zap} />
      <MetricCard
        label="Zone Accuracy"
        value={stats.zonePercentage.toFixed(1)}
        unit="%"
        helper={`${stats.inZone} in-zone`}
        icon={Target}
      />
      <MetricCard label="Avg Velo" value={mph(stats.avgVelocity)} unit="mph" helper="all pitches" icon={Gauge} />
    </section>
  );
}

export function VelocityMetrics() {
  const { stats } = useLivePitches();
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <MetricCard label="Peak Velocity" value={mph(stats.maxVelocity)} unit="mph" icon={Zap} />
      <MetricCard label="Mean Velocity" value={mph(stats.avgVelocity)} unit="mph" icon={TrendingUp} />
      <MetricCard label="Pitches" value={String(stats.count)} helper="rolling window" icon={Hash} />
    </section>
  );
}

export function PitchTypeBreakdown() {
  const { stats } = useLivePitches();
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {stats.byType.map((t) => (
        <div key={t.pitchType} className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-xs font-semibold">
              {t.pitchType}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{t.count} pitches</span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-semibold tabular-nums">{mph(t.avgVelocity)}</span>
            <span className="text-sm text-muted-foreground">avg mph</span>
          </div>
        </div>
      ))}
    </section>
  );
}
