import { createClient } from "@supabase/supabase-js";

/**
 * This API endpoint disables RLS on the live_pitches table
 * so that the ANON_KEY can read it for public real-time subscriptions
 * 
 * Usage: POST /api/disable-rls
 */
export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );

    // Query to disable RLS on live_pitches table
    // This allows public read access via ANON_KEY
    const { error } = await supabase.rpc("alter_table_disable_rls", {
      table_name: "live_pitches",
    });

    if (error) {
      // Try alternative approach using raw SQL
      return Response.json({
        message: "RLS may already be disabled or you need to run this manually in Supabase:",
        sql: `ALTER TABLE live_pitches DISABLE ROW LEVEL SECURITY;`,
        error: error.message,
      });
    }

    return Response.json({
      success: true,
      message: "RLS disabled on live_pitches table",
    });
  } catch (err) {
    return Response.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}
