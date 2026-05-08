import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

type MetricCardProps = {
  label: string;
  value: string;
  unit?: string;
  helper?: string;
  helperText?: string;
  delta?: number;
  icon?: LucideIcon;
};

export function MetricCard({
  label,
  value,
  unit,
  helper,
  helperText,
  delta,
  icon: Icon,
}: MetricCardProps) {
  const positive = (delta ?? 0) >= 0;
  const displayText = helper || helperText; // Safe fallback

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <div className="rounded-md bg-secondary/60 p-1.5 text-accent">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-mono text-3xl font-semibold tracking-tight">
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {delta !== undefined && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
              positive
                ? "bg-[oklch(0.7_0.18_145/0.15)] text-[oklch(0.78_0.15_145)]"
                : "bg-destructive/15 text-destructive"
            }`}
          >
            {positive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {displayText && (
          <p className="text-xs text-muted-foreground">{displayText}</p>
        )}
      </div>
    </div>
  );
}
