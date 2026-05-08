import { Radio } from "lucide-react";

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  meta?: { label: string; value: string }[];
};

export function PageHeader({ eyebrow, title, description, meta }: Props) {
  return (
    <header className="relative overflow-hidden rounded-xl border border-border gradient-hero p-6 sm:p-8 shadow-card">
      <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[oklch(0.7_0.18_145)]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
              {eyebrow}
            </p>
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {description}
          </p>
        </div>

        {meta && (
          <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-border/60 bg-card/40 px-5 py-4 backdrop-blur-sm">
            {meta.map((m) => (
              <div key={m.label}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {m.label}
                </p>
                <p className="mt-1 font-mono-stat text-base font-semibold">
                  {m.value}
                </p>
              </div>
            ))}
            <div className="flex items-center gap-2 border-l border-border/60 pl-5">
              <Radio className="h-3.5 w-3.5 text-[oklch(0.7_0.18_145)] animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[oklch(0.78_0.15_145)]">
                Live
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
