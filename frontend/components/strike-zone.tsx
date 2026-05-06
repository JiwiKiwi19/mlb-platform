type PitchDot = {
  zone_x: number | string | null | undefined;
  zone_z: number | string | null | undefined;
  zone_eval?: string;
};

type StrikeZoneProps = {
  pitchHistory: PitchDot[];
  latestPitch: PitchDot;
};

export function StrikeZone({ pitchHistory, latestPitch }: StrikeZoneProps) {
  const W = 300;
  const H = 320;

  const STRIKE_X_MIN = -0.83;
  const STRIKE_X_MAX = 0.83;
  const STRIKE_Z_MIN = 1.5;
  const STRIKE_Z_MAX = 3.5;

  const displayXMin = STRIKE_X_MIN - 0.9;
  const displayXMax = STRIKE_X_MAX + 0.9;
  const displayZMin = STRIKE_Z_MIN - 1.0;
  const displayZMax = STRIKE_Z_MAX + 1.0;

  const mapX = (x: number) =>
    ((x - displayXMin) / (displayXMax - displayXMin)) * W;
  const mapZ = (z: number) =>
    H - ((z - displayZMin) / (displayZMax - displayZMin)) * H;

  const szLeft = mapX(STRIKE_X_MIN);
  const szRight = mapX(STRIKE_X_MAX);
  const szBottom = mapZ(STRIKE_Z_MIN);
  const szTop = mapZ(STRIKE_Z_MAX);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 340,
        margin: "0 auto",
        borderRadius: 14,
        padding: 14,
        textAlign: "center",
        border: "1px solid var(--panel-border)",
        background: "var(--panel)",
        boxShadow: "var(--shadow)",
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="auto"
        style={{
          borderRadius: 10,
          background: "#f8fbff",
          border: "1px solid #dbe8fb",
          display: "block",
        }}
      >
        {/* Home Plate */}
        <path
          d={`M ${W / 2 - 24} ${H - 12} L ${W / 2 + 24} ${H - 12} L ${W / 2 + 24} ${H - 6} L ${W / 2} ${H} L ${W / 2 - 24} ${H - 6} Z`}
          fill="#cbd5e1"
          opacity="0.8"
        />

        {/* Strike Zone Box */}
        <rect
          x={szLeft}
          y={szTop}
          width={szRight - szLeft}
          height={szBottom - szTop}
          fill="rgba(0,102,204,0.04)"
          stroke="rgba(0, 63, 125, 0.45)"
          strokeWidth="2"
          strokeDasharray="6 4"
        />

        {/* Historical dots (faded) */}
        {pitchHistory.slice(0, -1).map((pitch, i) => {
          const px = Number(pitch.zone_x);
          const pz = Number(pitch.zone_z);
          if (!Number.isFinite(px) || !Number.isFinite(pz)) return null;
          const isStrike = pitch.zone_eval?.includes("IN ZONE");
          return (
            <circle
              key={i}
              cx={mapX(px)}
              cy={mapZ(pz)}
              r="6"
              fill={isStrike ? "#fb7185" : "#60a5fa"}
              opacity="0.35"
            />
          );
        })}

        {/* Latest pitch dot */}
        {(() => {
          const px = Number(latestPitch.zone_x);
          const pz = Number(latestPitch.zone_z);
          if (!Number.isFinite(px) || !Number.isFinite(pz)) return null;
          const isStrike = latestPitch.zone_eval?.includes("IN ZONE");
          const color = isStrike ? "#fb7185" : "#60a5fa";
          const shadow = isStrike
            ? "rgba(251,113,133,0.8)"
            : "rgba(96,165,250,0.8)";
          return (
            <circle
              cx={mapX(px)}
              cy={mapZ(pz)}
              r="9"
              fill={color}
              stroke="#fff"
              strokeWidth="2.5"
              style={{ filter: `drop-shadow(0 0 8px ${shadow})` }}
            />
          );
        })()}
      </svg>

      {/* Label OUTSIDE the SVG so it's always below */}
      <p
        style={{
          marginTop: 8,
          fontSize: "0.72rem",
          fontWeight: 700,
          color: "var(--muted)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        Catcher's View
      </p>
    </div>
  );
}
