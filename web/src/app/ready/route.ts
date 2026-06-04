export async function GET() {
  return Response.json({
    ok: true,
    ready: true,
    service: "web",
  });
}
