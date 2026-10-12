import { isInZone } from "@/lib/pitches";
import type { Pitch } from "@/lib/types";

type PitchDot = Pick<Pitch, "unique_id" | "zone_x" | "zone_z" | "zone_eval">;

export interface StrikeZoneProps {
  /** Newest first. The first entry is highlighted as the latest pitch. */
  pitches: readonly PitchDot[];
}

const W = 300;
const H = 320;

// Rule-book zone in feet (catcher's view); mirrors backend mlb_pipeline/zone.py.
const STRIKE_X_MIN = -0.83;
const STRIKE_X_MAX = 0.83;
const STRIKE_Z_MIN = 1.5;
const STRIKE_Z_MAX = 3.5;

const DISPLAY_X_MIN = STRIKE_X_MIN - 0.9;
const DISPLAY_X_MAX = STRIKE_X_MAX + 0.9;
const DISPLAY_Z_MIN = STRIKE_Z_MIN - 1.0;
const DISPLAY_Z_MAX = STRIKE_Z_MAX + 1.0;

const mapX = (x: number) => ((x - DISPLAY_X_MIN) / (DISPLAY_X_MAX - DISPLAY_X_MIN)) * W;
const mapZ = (z: number) => H - ((z - DISPLAY_Z_MIN) / (DISPLAY_Z_MAX - DISPLAY_Z_MIN)) * H;

const STRIKE_COLOR = "#fb7185";
const BALL_COLOR = "#60a5fa";

const SZ_LEFT = mapX(STRIKE_X_MIN);
const SZ_RIGHT = mapX(STRIKE_X_MAX);
const SZ_TOP = mapZ(STRIKE_Z_MAX);
const SZ_BOTTOM = mapZ(STRIKE_Z_MIN);

const hasLocation = (p: PitchDot): p is PitchDot & { zone_x: number; zone_z: number } =>
  p.zone_x !== null && p.zone_z !== null;

export function StrikeZone({ pitches }: StrikeZoneProps) {
  const [latest, ...history] = pitches;

  return (
    <figure className="mx-auto w-full max-w-85 rounded-xl border border-border bg-card p-3.5 text-center shadow-card">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full rounded-lg border border-[#dbe8fb] bg-[#f8fbff]"
        style={{ aspectRatio: `${W} / ${H}` }}
        role="img"
        aria-label={`Strike zone with ${pitches.length} pitch locations`}
      >
        <path
          d={`M ${W / 2 - 24} ${H - 12} L ${W / 2 + 24} ${H - 12} L ${W / 2 + 24} ${H - 6} L ${W / 2} ${H} L ${W / 2 - 24} ${H - 6} Z`}
          fill="#cbd5e1"
          opacity="0.8"
        />
        <rect
          x={SZ_LEFT}
          y={SZ_TOP}
          width={SZ_RIGHT - SZ_LEFT}
          height={SZ_BOTTOM - SZ_TOP}
          fill="rgba(0,102,204,0.04)"
          stroke="rgba(0, 63, 125, 0.45)"
          strokeWidth="2"
          strokeDasharray="6 4"
        />

        {history.filter(hasLocation).map((p) => (
          <circle
            key={p.unique_id}
            data-testid="pitch-dot"
            cx={mapX(p.zone_x)}
            cy={mapZ(p.zone_z)}
            r="6"
            fill={isInZone(p) ? STRIKE_COLOR : BALL_COLOR}
            opacity="0.35"
          />
        ))}

        {latest && hasLocation(latest) && (
          <circle
            data-testid="latest-pitch-dot"
            cx={mapX(latest.zone_x)}
            cy={mapZ(latest.zone_z)}
            r="9"
            fill={isInZone(latest) ? STRIKE_COLOR : BALL_COLOR}
            stroke="#fff"
            strokeWidth="2.5"
            style={{
              filter: `drop-shadow(0 0 8px ${isInZone(latest) ? "rgba(251,113,133,0.8)" : "rgba(96,165,250,0.8)"})`,
            }}
          />
        )}
      </svg>
      <figcaption className="mt-2 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Catcher&apos;s View
      </figcaption>
    </figure>
  );
}
