import { v4 as uuid } from "uuid";
import type { ImportRow, Player } from "./types";
import {
  buildMatchKey,
  findFuzzyMatch,
  FUZZY_NAME_TOLERANCE,
  levenshtein,
  normalizeName,
} from "./normalize";

export interface MergeResult {
  players: Player[];
  added: number;
  merged: number;
  fuzzyMerged: { name: string; matchedTo: string }[];
}

// Merges a freshly-imported set of rows (all belonging to one source) into
// an existing player pool.
//
// Matching strategy:
// - If the row has a position, match by exact normalized name+position
//   first, then fall back to a fuzzy name match within that same position
//   (e.g. "DJ Moore" vs "D.J. Moore").
// - If the row has NO position (common for a plain Name+ADP export), match
//   by name alone against the whole pool instead of requiring position —
//   otherwise a name-only file can never merge and just creates a full set
//   of duplicate players. Falls back to a fuzzy name-only match, and only
//   creates a new player if no reasonable match exists or the name is
//   ambiguous (multiple existing players share it).
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
    const hasPosition = !!row.position;
    let target: Player | undefined;

    if (hasPosition) {
      const exactKey = buildMatchKey(row.name, row.position);
      target = byMatchKey.get(exactKey);

      if (!target) {
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
    } else {
      const targetNorm = normalizeName(row.name);
      const nameMatches = players.filter((p) => normalizeName(p.name) === targetNorm);

      if (nameMatches.length === 1) {
        target = nameMatches[0];
      } else if (nameMatches.length === 0) {
        let best: { player: Player; distance: number } | null = null;
        for (const p of players) {
          const candNorm = normalizeName(p.name);
          const distance = levenshtein(targetNorm, candNorm);
          if (distance <= FUZZY_NAME_TOLERANCE && (!best || distance < best.distance)) {
            best = { player: p, distance };
          }
        }
        if (best) {
          target = best.player;
          fuzzyMerged.push({ name: row.name, matchedTo: best.player.name });
        }
      }
      // nameMatches.length > 1 (two existing players share this name) is
      // left unmatched rather than guessed at — falls through to "added".
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
      const matchKey = buildMatchKey(row.name, row.position || "OTHER");
      const newPlayer: Player = {
        id: uuid(),
        matchKey,
        name: row.name,
        team: row.team || "",
        position: row.position || "OTHER",
        bye: row.bye,
        values: [{ sourceId, value: row.value }],
        drafted: false,
        draftedAtPick: null,
        draftedByMe: false,
      };
      players.push(newPlayer);
      byMatchKey.set(matchKey, newPlayer);
      added++;
    }
  }

  return { players, added, merged, fuzzyMerged };
}

// Same exact-then-fuzzy name+position matching mergeRowsIntoPlayers uses,
// exposed standalone for callers that just need to look a player up (e.g.
// Sleeper sync matching a pick to an existing board player) without
// importing a full row.
export function findPlayerByNamePosition(
  players: Player[],
  name: string,
  position: string
): Player | undefined {
  const byMatchKey = new Map(players.map((p) => [p.matchKey, p]));
  const exactKey = buildMatchKey(name, position);
  const exact = byMatchKey.get(exactKey);
  if (exact) return exact;

  const fuzzyKey = findFuzzyMatch(
    name,
    position,
    players.map((p) => ({ matchKey: p.matchKey, name: p.name }))
  );
  return fuzzyKey ? byMatchKey.get(fuzzyKey) : undefined;
}
