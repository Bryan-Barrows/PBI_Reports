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

// Highlight tier for how close a player's ADP is to the current overall pick.
// "hot" = within 5 (great value likely gone soon / a reach if you wait),
// "warm" = within 10.
export function adpProximity(
  adp: number | null,
  currentPick: number
): "hot" | "warm" | null {
  if (adp === null) return null;
  const diff = Math.abs(adp - currentPick);
  if (diff <= 5) return "hot";
  if (diff <= 10) return "warm";
  return null;
}
