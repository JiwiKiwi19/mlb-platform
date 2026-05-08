import { createClient } from "@supabase/supabase-js";

/**
 * Sets up RLS policies for the live_pitches table
 * - Allows anyone (ANON_KEY) to SELECT (read) pitches
 * - Allows SERVICE_ROLE to INSERT/UPDATE/DELETE (for the backend)
 * 
 * Usage: POST /api/setup-rls
 */
export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );

    const instructions = {
      step1_disable_rls: `ALTER TABLE live_pitches DISABLE ROW LEVEL SECURITY;`,
      step2_enable_rls: `ALTER TABLE live_pitches ENABLE ROW LEVEL SECURITY;`,
      step3_policy_select: `
CREATE POLICY "Allow public read access" ON public.live_pitches
FOR SELECT USING (true);
      `,
      step4_policy_insert: `
CREATE POLICY "Allow service role insert" ON public.live_pitches
FOR INSERT WITH CHECK (auth.role() = 'service_role');
      `,
      manual_instruction: "Run these commands in Supabase SQL Editor",
    };

    return Response.json({
      message:
        "To enable real-time pitch updates, run these SQL commands in your Supabase dashboard:",
      steps: instructions,
      note: "These policies will allow public read access while keeping writes restricted to the backend service",
    });
  } catch (err) {
    return Response.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}
