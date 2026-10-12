import { LiveMeta, PitchTypeBreakdown, VelocityMetrics } from "@/components/live";
import { LiveVelocityChart } from "@/components/live-velocity-chart";
import { PageHeader } from "@/components/page-header";

export default function VelocityPage() {
  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <PageHeader
        eyebrow="Analytics"
        title="Velocity & Movement"
        description="Pitch-by-pitch velocity tracking with per-arsenal breakdowns."
        meta={<LiveMeta items={["top", "avg"]} />}
      />

      <VelocityMetrics />

      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <LiveVelocityChart />
      </section>

      <PitchTypeBreakdown />
    </div>
  );
}
