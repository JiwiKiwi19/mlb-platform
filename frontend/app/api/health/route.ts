export const dynamic = "force-dynamic";

// Liveness probe for container orchestration. Exposes no configuration.
export function GET() {
  return Response.json({ status: "ok" });
}
