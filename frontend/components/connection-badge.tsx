"use client";

import { useLivePitches } from "@/components/providers/live-pitches-provider";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/lib/types";

const LABELS: Record<ConnectionStatus, string> = {
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
  offline: "Offline",
};

const DOT: Record<ConnectionStatus, string> = {
  connecting: "bg-amber-400",
  live: "bg-[oklch(0.7_0.18_145)] animate-pulse",
  reconnecting: "bg-amber-400 animate-pulse",
  offline: "bg-muted-foreground",
};

export function ConnectionBadge({ className, label }: { className?: string; label?: string }) {
  const { status } = useLivePitches();
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT[status])} />
      {/* Fixed min-width keeps surrounding layout stable as the label changes. */}
      <span className="min-w-[5.5rem]">
        {LABELS[status]}
        {label ? ` · ${label}` : null}
      </span>
    </span>
  );
}
