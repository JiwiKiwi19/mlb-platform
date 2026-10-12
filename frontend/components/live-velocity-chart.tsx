"use client";

import { useLivePitches } from "@/components/providers/live-pitches-provider";
import { VelocityChart } from "@/components/velocity-chart";

export function LiveVelocityChart() {
  return <VelocityChart pitches={useLivePitches().pitches} />;
}
