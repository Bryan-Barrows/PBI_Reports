// Server-side proxy for FantasyPros' consensus-rankings API. Keeps the API
// key out of the browser entirely — it's read from an environment variable
// here, never sent to or exposed by the client.
//
// Note: the free/personal FantasyPros API tier does NOT include ADP data
// (confirmed — it returns `public_api_limited: true` with zero players for
// type=ADP). This route only fetches expert consensus rankings (ECR).
// ADP stays a manual paste/import in the app.

function currentSeasonYear(): number {
  const now = new Date();
  // NFL seasons are labeled by the year they start in (games run
  // Sept-Feb) — treat Jan/Feb as still the previous season.
  return now.getMonth() <= 1 ? now.getFullYear() - 1 : now.getFullYear();
}

const SCORING_MAP: Record<string, string> = {
  ppr: "PPR",
  "half-ppr": "HALF",
  standard: "STD",
};

export async function GET(request: Request) {
  const apiKey = process.env.FANTASYPROS_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "FANTASYPROS_API_KEY isn't set on the server. Add it as an environment variable (.env.local locally, Vercel project settings when deployed) and restart.",
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const scoring = SCORING_MAP[searchParams.get("scoring") ?? "ppr"] ?? "PPR";
  const year = searchParams.get("year") ?? String(currentSeasonYear());
  // OP = FantasyPros' combined overall board across QB/RB/WR/TE (one
  // consistent rank scale across positions) — not K/DST, which stay manual.
  const position = searchParams.get("position") ?? "OP";

  const url = `https://api.fantasypros.com/public/v2/json/nfl/${year}/consensus-rankings?type=ST&position=${position}&scoring=${scoring}`;

  try {
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) {
      return Response.json(
        { error: data?.message ?? `FantasyPros API error (HTTP ${res.status})` },
        { status: res.status }
      );
    }
    return Response.json(data);
  } catch {
    return Response.json({ error: "Couldn't reach FantasyPros." }, { status: 502 });
  }
}
