"use client";

// Realtime-connected alert widgets; read from LiveAlertsProvider.

import { useEffect } from "react";
import Link from "next/link";
import { Bell, Flame, TrendingDown, Users } from "lucide-react";
import { AlertList } from "@/components/alert-list";
import { MetricCard } from "@/components/metric-card";
import { MetaItem } from "@/components/page-header";
import { useLiveAlerts } from "@/components/providers/live-alerts-provider";
import { cn } from "@/lib/utils";

export function LiveAlertList() {
  return <AlertList alerts={useLiveAlerts().alerts} />;
}

export function AlertMetrics() {
  const { stats } = useLiveAlerts();
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Alerts" value={String(stats.count)} helper="rolling window" icon={Bell} />
      <MetricCard label="Critical" value={String(stats.critical)} helper="≥ 3.0 mph drop" icon={Flame} />
      <MetricCard label="Pitchers Flagged" value={String(stats.pitchersFlagged)} icon={Users} />
      <MetricCard
        label="Largest Drop"
        value={stats.largestDropMph.toFixed(1)}
        unit="mph"
        helper="vs. outing baseline"
        icon={TrendingDown}
      />
    </section>
  );
}

export function AlertsMeta() {
  const { stats } = useLiveAlerts();
  return (
    <>
      <MetaItem label="Warnings" value={String(stats.warning)} />
      <MetaItem label="Critical" value={String(stats.critical)} />
    </>
  );
}

/** Clears the unread badge while the alerts page is open, including for alerts that arrive meanwhile. */
export function MarkAlertsSeen() {
  const { unseen, markSeen } = useLiveAlerts();
  useEffect(() => {
    if (unseen > 0) markSeen();
  }, [unseen, markSeen]);
  return null;
}

export function AlertsBell() {
  const { unseen } = useLiveAlerts();
  const label = unseen > 0 ? `Fatigue alerts, ${unseen} new` : "Fatigue alerts";
  return (
    <Link
      href="/alerts"
      aria-label={label}
      title={label}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <Bell className="h-4 w-4" />
      <span
        aria-hidden
        className={cn(
          "absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-4 text-white tabular-nums",
          unseen === 0 && "hidden",
        )}
      >
        {unseen > 9 ? "9+" : unseen}
      </span>
    </Link>
  );
}
