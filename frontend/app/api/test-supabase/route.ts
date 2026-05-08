import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    // Try with ANON key first
    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data: dataAnon, error: errorAnon } = await supabaseAnon
      .from("live_pitches")
      .select("count", { count: "exact" });

    // Try with SERVICE key if available
    let dataService = null;
    let errorService = null;
    if (process.env.SUPABASE_SERVICE_KEY) {
      const supabaseService = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY,
      );
      const result = await supabaseService
        .from("live_pitches")
        .select("*", { count: "exact" })
        .limit(5);
      dataService = result.data;
      errorService = result.error;
    }

    return Response.json({
      anon: {
        success: !errorAnon,
        error: errorAnon?.message,
        count: dataAnon,
      },
      service: {
        available: !!process.env.SUPABASE_SERVICE_KEY,
        success: !errorService,
        error: errorService?.message,
        count: dataService?.length,
        pitches: dataService,
      },
    });
  } catch (err) {
    return Response.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}
