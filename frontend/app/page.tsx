import { ConnectionBadge } from "@/components/connection-badge";
import { LiveMeta, LivePitchTable, OverviewMetrics } from "@/components/live";
import { LiveVelocityChart } from "@/components/live-velocity-chart";
import { MetaItem, PageHeader } from "@/components/page-header";

const PIPELINE = [
  { k: "Producer", v: "MLB Stats API" },
  { k: "Broker", v: "Redpanda" },
  { k: "Consumer", v: "Python Engine" },
  { k: "Sink", v: "Postgres Realtime" },
];

export default function Overview() {
  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <PageHeader
        eyebrow="Game Day · TOR Live Feed"
        title="Live Pitch Intelligence"
        description="Real-time Statcast feed processed through the streaming pipeline. Every pitch, classified and scored within a second of release."
        meta={
          <>
            <MetaItem label="Topic" value="live-pitches" />
            <LiveMeta items={["top"]} />
          </>
        }
      />

      <OverviewMetrics />

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card lg:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Velocity Trend</p>
          <h2 className="font-display mb-4 mt-1 text-xl font-semibold">Session Pitch Speed</h2>
          <LiveVelocityChart />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Pipeline</p>
          <h2 className="font-display mt-1 text-xl font-semibold">Stream Health</h2>
          <ul className="mt-5 space-y-3.5 text-sm">
            {PIPELINE.map((r) => (
              <li key={r.k} className="border-b border-border/60 pb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{r.k}</p>
                <p className="mt-0.5 text-sm">{r.v}</p>
              </li>
            ))}
            <li className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dashboard feed</p>
              <ConnectionBadge />
            </li>
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Stream Log</p>
        <h2 className="font-display mb-4 mt-1 text-xl font-semibold">Recent Pitches</h2>
        <LivePitchTable />
      </section>
    </div>
  );
}
