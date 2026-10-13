import { memo } from "react";
import { AlertTriangle, Flame, Info } from "lucide-react";
import { formatPitchTime } from "@/lib/pitches";
import type { PitchAlert } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEVERITY = {
  critical: { icon: Flame, label: "Critical", tone: "border-destructive/40 bg-destructive/10 text-destructive" },
  warning: { icon: AlertTriangle, label: "Warning", tone: "border-amber-400/40 bg-amber-400/10 text-amber-400" },
  info: { icon: Info, label: "Info", tone: "border-accent/40 bg-accent/10 text-accent" },
} as const;

const mph = (v: number | null) => (v === null ? "--" : v.toFixed(1));

// Alerts keep object identity across merges, so only newly arrived items render.
const AlertItem = memo(function AlertItem({ alert }: { alert: PitchAlert }) {
  const { icon: Icon, label, tone } = SEVERITY[alert.severity];
  return (
    <li className="flex gap-4 border-b border-border/60 py-4 last:border-0">
      <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border", tone)}>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">{alert.pitcher_name ?? `Pitcher ${alert.pitcher_id}`}</span>
          <span
            className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", tone)}
          >
            {label}
          </span>
          {alert.pitch_type && (
            <span className="rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-xs">
              {alert.pitch_type}
            </span>
          )}
          <time className="ml-auto font-mono text-xs tabular-nums text-muted-foreground" dateTime={alert.created_at}>
            {formatPitchTime(alert.created_at)} ET
          </time>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
        {alert.baseline_mph !== null && alert.recent_mph !== null && (
          <p className="mt-2 font-mono text-xs tabular-nums text-muted-foreground">
            baseline {mph(alert.baseline_mph)} → recent {mph(alert.recent_mph)} mph
            {alert.delta_mph !== null && (
              <span className="ml-2 font-semibold text-destructive">{mph(alert.delta_mph)}</span>
            )}
          </p>
        )}
      </div>
    </li>
  );
});

export function AlertList({ alerts }: { alerts: readonly PitchAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        No fatigue alerts yet. They appear here the moment the intelligence engine flags a velocity drop.
      </div>
    );
  }
  return (
    <ul aria-label="Fatigue alerts" className="-my-4">
      {alerts.map((a) => (
        <AlertItem key={a.unique_id} alert={a} />
      ))}
    </ul>
  );
}

export function hello() {
  ("hello world");
}
// This is the test
