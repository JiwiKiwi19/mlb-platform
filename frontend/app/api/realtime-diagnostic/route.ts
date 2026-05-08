import { createClient } from "@supabase/supabase-js";

/**
 * Diagnostic endpoint to check Realtime subscription status and test connectivity
 */
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    // Test 1: Basic read access
    const { data: readTest, error: readError } = await supabase
      .from("live_pitches")
      .select("*")
      .limit(1);

    // Test 2: Try to create a test subscription (will timeout if Realtime not enabled)
    let subscriptionStatus = "unknown";
    const channel = supabase
      .channel("realtime-diagnostic-test")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_pitches" },
        () => {
          subscriptionStatus = "active";
        },
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
        if (status === "SUBSCRIBED") subscriptionStatus = "subscribed";
        else if (status === "CLOSED") subscriptionStatus = "closed";
        else if (status === "CHANNEL_ERROR") subscriptionStatus = "error";
      });

    // Wait a moment for subscription to connect
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const subscriptionInfo = supabase.getChannels();

    return Response.json({
      read_access: {
        success: !readError,
        error: readError?.message,
        pitch_count: readTest?.length,
      },
      realtime_subscription: {
        status: subscriptionStatus,
        channel_count: subscriptionInfo.length,
        channels: subscriptionInfo.map((ch) => ({
          name: ch.topic,
          state: ch.state,
        })),
      },
      instructions: {
        if_realtime_not_working:
          "Enable Realtime in Supabase: Project Settings > Replication > Toggle 'live_pitches'",
        if_no_subscriptions:
          "Check browser console for WebSocket errors",
      },
    });
  } catch (err) {
    return Response.json(
      { error: String(err), stack: err instanceof Error ? err.stack : "" },
      { status: 500 },
    );
  }
}
