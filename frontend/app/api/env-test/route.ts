export async function GET() {
  return Response.json({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    keyStart: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 30),
  });
}