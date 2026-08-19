// Server-side proxy for Sleeper's public API (api.sleeper.app). Sleeper's
// API needs no auth/key, but this proxy avoids relying on Sleeper's CORS
// headers being browser-friendly, and keeps every Sleeper call going
// through one place. Read-only — only GET is exposed.

const SLEEPER_BASE = "https://api.sleeper.app/v1";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const incoming = new URL(request.url);
  const url = `${SLEEPER_BASE}/${path.join("/")}${incoming.search}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return Response.json(
      { error: "Couldn't reach the Sleeper API." },
      { status: 502 }
    );
  }
}
