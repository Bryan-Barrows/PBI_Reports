import { v4 as uuid } from "uuid";
import type { ImportRow, Player } from "./types";
import { buildMatchKey, findFuzzyMatch } from "./normalize";

export interface MergeResult {
  players: Player[];
  added: number;
  merged: number;
  fuzzyMerged: { name: string; matchedTo: string }[];
}

// Merges a freshly-imported set of rows (all belonging to one source) into
// an existing player pool, matching by exact normalized name+position first,
// then falling back to a fuzzy match so minor spelling differences across
// sites (e.g. "DJ Moore" vs "D.J. Moore") still land on the same player.
export function mergeRowsIntoPlayers(
  existing: Player[],
  rows: ImportRow[],
  sourceId: string
): MergeResult {
  const players = existing.map((p) => ({ ...p, values: [...p.values] }));
  const byMatchKey = new Map(players.map((p) => [p.matchKey, p]));
  let added = 0;
  let merged = 0;
  const fuzzyMerged: { name: string; matchedTo: string }[] = [];

  for (const row of rows) {
    if (row.value === null) continue;
    const exactKey = buildMatchKey(row.name, row.position || "OTHER");
    let target = byMatchKey.get(exactKey);

    if (!target && row.position) {
      const fuzzyKey = findFuzzyMatch(
        row.name,
        row.position,
        players.map((p) => ({ matchKey: p.matchKey, name: p.name }))
      );
      if (fuzzyKey) {
        target = byMatchKey.get(fuzzyKey);
        if (target) fuzzyMerged.push({ name: row.name, matchedTo: target.name });
      }
    }

    if (target) {
      const existingValueIdx = target.values.findIndex(
        (v) => v.sourceId === sourceId
      );
      if (existingValueIdx >= 0) {
        target.values[existingValueIdx] = { sourceId, value: row.value };
      } else {
        target.values.push({ sourceId, value: row.value });
      }
      if (!target.team && row.team) target.team = row.team;
      if (target.bye === null && row.bye !== null) target.bye = row.bye;
      merged++;
    } else {
      const newPlayer: Player = {
        id: uuid(),
        matchKey: exactKey,
        name: row.name,
        team: row.team || "",
        position: row.position || "OTHER",
        bye: row.bye,
        values: [{ sourceId, value: row.value }],
        drafted: false,
        draftedAtPick: null,
      };
      players.push(newPlayer);
      byMatchKey.set(exactKey, newPlayer);
      added++;
    }
  }

  return { players, added, merged, fuzzyMerged };
}
