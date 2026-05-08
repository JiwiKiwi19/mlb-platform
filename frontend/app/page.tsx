import { createClient } from "@supabase/supabase-js";
import { Activity, Gauge, Target, Zap } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { VelocityChart } from "@/components/velocity-chart";
import { PitchTable } from "@/components/pitch-table";

export const dynamic = "force-dynamic";

export default async function Overview() {
  // Use SERVICE_KEY to bypass RLS restrictions
  const serviceKey =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey!,
  );

  const { data } = await supabase
    .from("live_pitches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  const pitches: any[] = data || [];

  const max = pitches.length
    ? Math.max(...pitches.map((p) => p.speed_mph || 0))
    : 0;
  const avg = pitches.length
    ? pitches.reduce((a, p) => a + (p.speed_mph || 0), 0) / pitches.length
    : 0;
  const inZone = pitches.filter((p) => p.zone_eval?.includes("IN ZONE")).length;
  const zonePct = pitches.length ? (inZone / pitches.length) * 100 : 0;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow="Game Day · TOR Live Feed"
        title="Live Pitch Intelligence"
        description="Real-time Statcast feed processed through the streaming pipeline. Every pitch, classified and scored within a second of release."
        meta={[
          { label: "Status", value: "Live Polling" },
          { label: "Topic", value: "live-pitches" },
        ]}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Pitches Tracked"
          value={pitches.length.toString()}
          helper="this session"
          icon={Activity}
        />
        <MetricCard
          label="Top Velocity"
          value={max.toFixed(1)}
          unit="mph"
          helper="Session Max"
          icon={Zap}
        />
        <MetricCard
          label="Zone Accuracy"
          value={zonePct.toFixed(1)}
          unit="%"
          helper={`${inZone} in-zone`}
          icon={Target}
        />
        <MetricCard
          label="Avg Velo"
          value={avg.toFixed(1)}
          unit="mph"
          helper="All pitches"
          icon={Gauge}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card lg:col-span-2">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                Velocity Trend
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold">
                Session Pitch Speed
              </h2>
            </div>
          </div>
          <VelocityChart pitches={pitches} />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
            Pipeline
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold">
            Stream Health
          </h2>
          <ul className="mt-5 space-y-3.5 text-sm">
            {[
              { k: "Producer", v: "MLB Stats API" },
              { k: "Broker", v: "Redpanda" },
              { k: "Consumer", v: "Python Engine" },
              { k: "Sink", v: "Postgres Realtime" },
            ].map((r) => (
              <li
                key={r.k}
                className="flex items-center justify-between border-b border-border/60 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {r.k}
                  </p>
                  <p className="mt-0.5 text-sm">{r.v}</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-[oklch(0.7_0.18_145)] shadow-[0_0_8px_oklch(0.7_0.18_145)]" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
              Stream Log
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold">
              Recent Pitches
            </h2>
          </div>
        </div>
        <PitchTable pitches={pitches} />
      </section>
    </div>
  );
}
