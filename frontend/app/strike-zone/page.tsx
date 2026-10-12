import { LiveMeta, LivePitchTable, LiveStrikeZone } from "@/components/live";
import { PageHeader } from "@/components/page-header";

export default function StrikeZonePage() {
  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <PageHeader
        eyebrow="Spatial"
        title="Strike Zone Intelligence"
        description="Locate every pitch within the rule-book zone, with the full pitch log alongside."
        meta={<LiveMeta items={["inZone", "zonePct"]} />}
      />

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-6 shadow-card lg:col-span-2">
          <LiveStrikeZone />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-card lg:col-span-3">
          <LivePitchTable />
        </div>
      </section>
    </div>
  );
}
