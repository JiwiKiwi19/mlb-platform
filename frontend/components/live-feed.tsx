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
          console.log("[LiveFeed] 🎯 New pitch received:", payload.new.pitch_type);
          setLatestPitch(payload.new);
          setPitchHistory((prev) => {
            const newHistory = [...prev.slice(-49), payload.new];
            console.debug("[LiveFeed] pitchHistory updated:", {
              length: newHistory.length,
              latest_zone_x: payload.new.zone_x,
              latest_zone_z: payload.new.zone_z,
              latest_zone_eval: payload.new.zone_eval,
            });
            return newHistory;
          });
          markLive();
        },
      )
      .subscribe((status) => {
        console.log("[LiveFeed] Subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("[LiveFeed] ✅ Realtime subscriptions active");
        }
      });

    // Debug: Check initial pitch data
    if (initialPitch) {
      console.log(
        "[LiveFeed] 📊 Initial pitch loaded:",
        initialPitch.pitch_type,
      );
    }

    return () => {
      supabase.removeChannel(channel);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Show nothing if no pitch data yet
  if (!latestPitch) {
    return null;
  }

  const isStrike = latestPitch.zone_eval?.includes("IN ZONE");

  return (
    <div className="live-feed">
      <div
        className="live-feed-inner"
        style={{ display: "flex", gap: 24, alignItems: "center" }}
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

        {/* Right: strike zone — keep showing the latest pitch state */}
        <div
          style={{
            flex: 1,
            maxWidth: 280,
            transition: "opacity 0.4s ease",
            opacity: isLive ? 1 : 0.82,
          }}
        >
          <StrikeZone pitches={pitchHistory} />
        </div>
        
      </div>
    </div>
  );
}
