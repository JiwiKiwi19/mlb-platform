import { memo } from "react";
import { cn } from "@/lib/utils";
import { formatPitchTime, isInZone } from "@/lib/pitches";
import type { Pitch } from "@/lib/types";

const HOT_VELOCITY_MPH = 96;

// Rows keep object identity across realtime merges, so only new rows re-render.
const PitchRow = memo(function PitchRow({ pitch }: { pitch: Pitch }) {
  const hot = (pitch.speed_mph ?? 0) >= HOT_VELOCITY_MPH;
  const inZone = isInZone(pitch);

  return (
    <tr className="border-b border-border/60 last:border-0 transition-colors hover:bg-secondary/30">
      <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">
        <time dateTime={pitch.timestamp ?? pitch.created_at}>
          {formatPitchTime(pitch.timestamp ?? pitch.created_at)}
        </time>
      </td>
      <td className="px-4 py-3 font-medium">{pitch.pitcher_full_name}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-xs font-medium">
          {pitch.pitch_type}
        </span>
      </td>
      <td className={cn("px-4 py-3 text-right font-mono font-semibold tabular-nums", hot && "text-red-500")}>
        {pitch.speed_mph !== null ? pitch.speed_mph.toFixed(1) : "--"}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
        {pitch.inning ?? "--"}
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
            inZone ? "bg-emerald-500/10 text-emerald-500" : "bg-secondary/60 text-muted-foreground",
          )}
        >
          {pitch.zone_eval}
        </span>
      </td>
    </tr>
  );
});

export function PitchTable({ pitches }: { pitches: readonly Pitch[] }) {
  if (pitches.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Waiting for stream data...
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="w-28 px-4 py-3">Time (ET)</th>
            <th className="px-4 py-3">Pitcher</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3 text-right">Velo</th>
            <th className="px-4 py-3 text-right">Inn</th>
            <th className="px-4 py-3">Result</th>
          </tr>
        </thead>
        <tbody>
          {pitches.map((p) => (
            <PitchRow key={p.unique_id} pitch={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
