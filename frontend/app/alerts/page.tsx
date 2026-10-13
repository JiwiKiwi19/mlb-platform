import { AlertMetrics, AlertsMeta, LiveAlertList, MarkAlertsSeen } from "@/components/live-alerts";
import { PageHeader } from "@/components/page-header";

export default function AlertsPage() {
  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <MarkAlertsSeen />
      <PageHeader
        eyebrow="Intelligence Engine"
        title="Fatigue Alerts"
        description="Velocity drops flagged per pitcher and pitch type against each outing's baseline, streamed as the consumer detects them."
        meta={<AlertsMeta />}
      />

      <AlertMetrics />

      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Alert Feed</p>
        <h2 className="font-display mb-4 mt-1 text-xl font-semibold">Latest Alerts</h2>
        <LiveAlertList />
      </section>
    </div>
  );
}
