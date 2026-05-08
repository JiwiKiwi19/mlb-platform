import { createClient } from "@supabase/supabase-js";
import { PageHeader } from "@/components/page-header";
import { VelocityChart } from "@/components/velocity-chart";
import { MetricCard } from "@/components/metric-card";
import { TrendingUp, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VelocityPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data } = await supabase
    .from("live_pitches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  const pitches: any[] = data || [];

  const byType: Record<string, number[]> = {};
  pitches.forEach((p) => {
    const type = p.pitch_type || "Unknown";
    (byType[type] ||= []).push(p.speed_mph || 0);
  });

  const max = pitches.length
    ? Math.max(...pitches.map((p) => p.speed_mph || 0))
    : 0;
  const avg = pitches.length
    ? pitches.reduce((a, p) => a + (p.speed_mph || 0), 0) / pitches.length
    : 0;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow="Analytics"
        title="Velocity & Movement"
        description="Pitch-by-pitch velocity tracking with per-arsenal breakdowns and rolling baselines."
        meta={[
          { label: "Top", value: `${max.toFixed(1)} mph` },
          { label: "Avg", value: `${avg.toFixed(1)} mph` },
        ]}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Peak Velocity"
          value={max.toFixed(1)}
          unit="mph"
          icon={Zap}
        />
        <MetricCard
          label="Mean Velocity"
          value={avg.toFixed(1)}
          unit="mph"
          icon={TrendingUp}
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <VelocityChart pitches={pitches} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(byType).map(([type, speeds]) => {
          const a = speeds.reduce((x, y) => x + y, 0) / speeds.length;
          return (
            <div
              key={type}
              className="rounded-xl border border-border bg-card p-5 shadow-card"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-xs font-semibold">
                  {type}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {speeds.length} pitches
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-semibold">
                  {a.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">avg mph</span>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
