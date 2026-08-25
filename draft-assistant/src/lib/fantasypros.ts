// Client-side helper for the /api/fantasypros/rankings proxy.
import type { ImportRow } from "./types";

export interface FantasyProsPlayer {
  player_name: string;
  player_team_id: string;
  player_position_id: string;
  player_bye_week: string;
  rank_ecr: number;
}

export interface FantasyProsResponse {
  players: FantasyProsPlayer[];
  count: number;
  public_api_limited?: boolean;
}

export async function fetchFantasyProsRankings(
  scoring: "ppr" | "half-ppr" | "standard"
): Promise<FantasyProsResponse> {
  const res = await fetch(
    `/api/fantasypros/rankings?scoring=${encodeURIComponent(scoring)}`
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? `FantasyPros error (HTTP ${res.status})`);
  }
  return data as FantasyProsResponse;
}

export function fantasyProsPlayersToRows(players: FantasyProsPlayer[]): ImportRow[] {
  return players
    .filter((p) => typeof p.rank_ecr === "number")
    .map((p) => ({
      name: p.player_name,
      team: p.player_team_id || "",
      position: p.player_position_id || "",
      bye: p.player_bye_week ? parseInt(p.player_bye_week, 10) || null : null,
      value: p.rank_ecr,
    }));
}
