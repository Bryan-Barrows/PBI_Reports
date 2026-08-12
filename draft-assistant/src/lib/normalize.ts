// Player identity normalization so the same player pulled from different
// ranking sites (different spacing, punctuation, suffixes) merges into one row.

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

export function normalizeName(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[.'’]/g, "")
    .replace(/-/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter((word) => !SUFFIXES.has(word));
  return cleaned.join(" ");
}

export function normalizePosition(raw: string): string {
  const p = raw.trim().toUpperCase();
  if (p === "PK") return "K";
  if (p === "DEF" || p === "D/ST" || p === "DST") return "DST";
  // Strip trailing rank digits some sites append, e.g. "RB1" -> "RB"
  const stripped = p.replace(/[0-9]+$/, "");
  return stripped || p;
}

export function buildMatchKey(name: string, position: string): string {
  return `${normalizeName(name)}|${normalizePosition(position)}`;
}

// Simple Levenshtein distance for fuzzy-matching names that don't collide
// exactly (e.g. "DJ Moore" vs "D J Moore").
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Fixed (not length-scaled) edit-distance tolerance for fuzzy name matching.
// Deliberately tight: fantasy football has real, distinct players whose
// names differ by just 1-2 characters (e.g. "Brian Robinson" vs "Bijan
// Robinson" — different people, both RBs). A tolerance of 2 merges them; 1
// still catches genuine typos/formatting slips (a dropped or doubled
// letter) without conflating two real players.
export const FUZZY_NAME_TOLERANCE = 1;

// Finds the closest existing normalized name sharing the same position,
// within FUZZY_NAME_TOLERANCE edits.
export function findFuzzyMatch(
  targetName: string,
  targetPosition: string,
  candidates: { matchKey: string; name: string }[]
): string | null {
  const targetNorm = normalizeName(targetName);
  const posNorm = normalizePosition(targetPosition);
  let best: { matchKey: string; distance: number } | null = null;

  for (const candidate of candidates) {
    const [candNorm, candPos] = candidate.matchKey.split("|");
    if (candPos !== posNorm) continue;
    const distance = levenshtein(targetNorm, candNorm);
    if (distance <= FUZZY_NAME_TOLERANCE) {
      if (!best || distance < best.distance) {
        best = { matchKey: candidate.matchKey, distance };
      }
    }
  }
  return best ? best.matchKey : null;
}
