import { createClient } from "@supabase/supabase-js";
import { PageHeader } from "@/components/page-header";
import { StrikeZone } from "@/components/strike-zone";
import { PitchTable } from "@/components/pitch-table";

export const dynamic = "force-dynamic";

export default async function StrikeZonePage() {
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

  const inZone = pitches.filter((p) => p.zone_eval?.includes("IN ZONE")).length;
  const pct = pitches.length
    ? ((inZone / pitches.length) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow="Spatial"
        title="Strike Zone Intelligence"
        description="Locate every pitch within the rule-book zone. Heat-mapped 3×3 grid with full pitch log."
        meta={[
          { label: "In Zone", value: `${inZone}/${pitches.length}` },
          { label: "Zone %", value: `${pct}%` },
        ]}
      />

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-6 shadow-card lg:col-span-2">
          <StrikeZone pitches={pitches} />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-card lg:col-span-3">
          <PitchTable pitches={pitches} />
        </div>
      </section>
    </div>
  );
}
