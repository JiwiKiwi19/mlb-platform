"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { StrikeZone } from "./strike-zone";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface LiveFeedProps {
  initialPitch?: any;
}

export function LiveFeed({ initialPitch }: LiveFeedProps) {
  const [latestPitch, setLatestPitch] = useState<any>(initialPitch ?? null);
  const [pitchHistory, setPitchHistory] = useState<any[]>(
    initialPitch ? [initialPitch] : [],
  );
  const [isLive, setIsLive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markLive = () => {
    setIsLive(true);
    // If no new pitch arrives within 10 seconds, mark as offline
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsLive(false);
    }, 10000);
  };

  useEffect(() => {
    const channel = supabase
      .channel("realtime-pitches")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_pitches" },
        (payload) => {
          setLatestPitch(payload.new);
          setPitchHistory((prev) => [...prev.slice(-49), payload.new]);
          markLive();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!latestPitch || !isLive) {
    return (
      <div className="empty-state">
        <p style={{ margin: 0, fontWeight: 700 }}>Stream Offline</p>
        <p style={{ margin: "4px 0 0", fontSize: "0.82rem" }}>
          Strike zone feed will appear when the game is live.
        </p>
      </div>
    );
  }

  const isStrike = latestPitch.zone_eval?.includes("IN ZONE");

  return (
    <div
      className="live-feed"
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 24,
        padding: "20px 28px",
      }}
    >
      {/* Left: pitch info */}
      <div style={{ flex: "0 0 auto", textAlign: "center", minWidth: 180 }}>
        <p className="feed-label" style={{ margin: "0 0 4px" }}>
          Live from the Mound
        </p>
        <h2 className="feed-velocity" style={{ margin: "0 0 2px" }}>
          {latestPitch.speed_mph?.toFixed(1)} mph
        </h2>
        <p className="feed-type" style={{ margin: "0 0 8px" }}>
          {latestPitch.pitch_type}
        </p>
        <p
          style={{
            margin: "0 0 4px",
            fontSize: "0.8rem",
            color: "var(--muted)",
            fontWeight: 600,
          }}
        >
          {latestPitch.pitcher_full_name}
        </p>
        <span className={`zone-pill ${isStrike ? "in" : "out"}`}>
          {latestPitch.zone_eval}
        </span>

        {/* Stream status indicator */}
        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isLive ? "var(--success)" : "var(--muted)",
              display: "inline-block",
              boxShadow: isLive ? "0 0 6px var(--success)" : "none",
              transition: "all 0.4s ease",
            }}
          />
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "var(--muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {isLive ? "Stream Live" : "Stream Offline"}
          </span>
        </div>
      </div>

      {/* Right: strike zone — only visible when live */}
      {isLive && (
        <div
          style={{ flex: 1, maxWidth: 280, transition: "opacity 0.4s ease" }}
        >
          <StrikeZone pitchHistory={pitchHistory} latestPitch={latestPitch} />
        </div>
      )}
    </div>
  );
}
