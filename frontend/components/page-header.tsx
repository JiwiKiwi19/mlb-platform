import type { ReactNode } from "react";
import { ConnectionBadge } from "@/components/connection-badge";

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  /** MetaItem elements (static or live). */
  meta?: ReactNode;
};

export function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-mono-stat mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, meta }: Props) {
  return (
    <header className="gradient-hero relative overflow-hidden rounded-xl border border-border p-6 shadow-card sm:p-8">
      <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] bg-size-[32px_32px]" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
          <h1 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">{description}</p>
        </div>

        {meta && (
          <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-border/60 bg-card/40 px-5 py-4 backdrop-blur-sm">
            {meta}
            <div className="flex items-center border-l border-border/60 pl-5">
              <ConnectionBadge />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
