import type { LucideIcon } from "lucide-react";

type MetricCardProps = {
  label: string;
  value: string;
  unit?: string;
  helper?: string;
  icon?: LucideIcon;
};

export function MetricCard({ label, value, unit, helper, icon: Icon }: MetricCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon && (
          <div className="rounded-md bg-secondary/60 p-1.5 text-accent">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-mono text-3xl font-semibold tracking-tight">{value}</span>
        {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
      </div>
      {helper && <p className="mt-2 text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}
