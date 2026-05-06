import { createClient } from "@supabase/supabase-js";
import DashboardShell from "@/components/dashboard-shell";
import { PitchTable } from "@/components/pitch-table";
import { MetricCard } from "@/components/metric-card";
import { LiveFeed } from "@/components/live-feed";
import { VelocityChart } from "@/components/velocity-chart";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("live_pitches")
    .select("*")
    .order("id", { ascending: false })
    .limit(50);

  const validPitches: any[] = (Array.isArray(data) ? data : []) as any[];

  if (error) {
    return (
      <div className="p-10 text-red-500">Database Error: {error.message}</div>
    );
  }

  const maxSpeed =
    validPitches.length > 0
      ? Math.max(...validPitches.map((p) => p.speed_mph || 0))
      : 0;

  const inZoneCount = validPitches.filter((p) =>
    p.zone_eval?.includes("IN ZONE"),
  ).length;
  const zonePercent =
    validPitches.length > 0 ? (inZoneCount / validPitches.length) * 100 : 0;

  return (
    <DashboardShell>
      <section className="hero">
        <div>
          <p className="eyebrow">Real-Time Event Stream</p>
          <h1>MLB Live Pitch Analytics Lakehouse.</h1>
          <p className="hero-copy">
            This dashboard consumes a live Redpanda stream, processed in
            real-time by a Python analytics consumer, and broadcasted via
            Supabase WebSockets.
          </p>
        </div>
        <div className="hero-panel">
          <span className="panel-label">Infrastructure Status</span>
          <strong className="text-emerald-400">Stream Online</strong>
          <p>Listening to topic: `live-pitches`</p>
        </div>
      </section>

      <section className="metrics-grid mb-8">
        <MetricCard
          label="Pitches Processed"
          value={validPitches.length.toString()}
          helperText="In current session view"
        />
        <MetricCard
          label="Top Velocity"
          value={`${maxSpeed.toFixed(1)}`}
          helperText="Max MPH in session"
        />
        <MetricCard
          label="Zone Accuracy"
          value={`${zonePercent.toFixed(1)}%`}
          helperText="Pitches inside the strike zone"
        />
        <MetricCard
          label="Ingestion Latency"
          value="< 1s"
          helperText="API to Web UI"
        />
      </section>

      <section className="live-row mb-8">
        <LiveFeed initialPitch={validPitches[0] ?? null} />
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-header mb-0">
            <div>
              <p className="section-label">Latest Velocity Trend</p>
              <h2>Session Pitch Speeds</h2>
            </div>
            <span className="chip">Live Tracking</span>
          </div>

          <VelocityChart pitches={validPitches} />

          <div className="panel-header mt-8">
            <div>
              <p className="section-label">Stream Log</p>
              <h2>Recent Pitches</h2>
            </div>
          </div>

          <PitchTable pitches={validPitches} />
        </article>

        <aside className="panel notes-panel">
          <div>
            <p className="section-label">Data Architecture</p>
            <h2>The Pipeline</h2>
          </div>
          <ul>
            <li>
              <strong>Extract:</strong> Python polling MLB Stats API
            </li>
            <li>
              <strong>Buffer:</strong> Local Redpanda (Kafka) Cluster
            </li>
            <li>
              <strong>Consume:</strong> Python real-time spatial analytics
            </li>
            <li>
              <strong>Load:</strong> Supabase PostgreSQL
            </li>
            <li>
              <strong>Serve:</strong> Next.js + Realtime WebSockets
            </li>
          </ul>
        </aside>
      </section>
    </DashboardShell>
  );
}
