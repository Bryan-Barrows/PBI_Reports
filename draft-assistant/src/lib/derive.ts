import type { Player, RankingSource } from "./types";

export interface PlayerDerived {
  consensusRank: number | null; // average across "rank" sources
  adp: number | null; // average across "adp" sources
  proximity: "hot" | "warm" | null; // relative to current pick
}

export function computeConsensusAndAdp(
  player: Player,
  sources: RankingSource[]
): { consensusRank: number | null; adp: number | null } {
  const sourceKind = new Map(sources.map((s) => [s.id, s.kind]));
  const rankValues: number[] = [];
  const adpValues: number[] = [];

  for (const v of player.values) {
    const kind = sourceKind.get(v.sourceId);
    if (kind === "adp") adpValues.push(v.value);
    else if (kind === "rank") rankValues.push(v.value);
  }

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return { consensusRank: avg(rankValues), adp: avg(adpValues) };
}

// Highlight tier for a player's ADP relative to the current overall pick.
// "hot" = their ADP has already passed this pick (average drafters would
// have taken them by now — a value sitting on the board, grab them).
// "warm" = their ADP is coming up within the next 10 picks.
export function adpProximity(
  adp: number | null,
  currentPick: number
): "hot" | "warm" | null {
  if (adp === null) return null;
  if (adp <= currentPick) return "hot";
  if (adp - currentPick <= 10) return "warm";
  return null;
}
