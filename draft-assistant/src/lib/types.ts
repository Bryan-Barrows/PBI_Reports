// Core data model for the draft assistant.
//
// Design notes:
// - Players live inside a Board (each board has its own imported pool, since
//   different drafts may use different ranking snapshots).
// - Love/Like/Maybe/No tags are stored globally, keyed by a normalized
//   player identity, so your opinion of a player carries across boards.
// - "Resetting" a board only clears drafted state + the pick counter.

export type Tag = "love" | "like" | "maybe" | "no";

export type Platform = "sleeper" | "fleaflicker" | "other";

export type Scoring = "ppr" | "half-ppr" | "standard";

export type SourceKind = "rank" | "adp";

export interface LeagueSettings {
  teams: number;
  scoring: Scoring;
  superflex: boolean;
  dynasty: boolean;
}

export interface RankingSource {
  id: string;
  name: string; // user-provided label, e.g. "FantasyPros ECR", "Sleeper ADP"
  kind: SourceKind;
  importedAt: string;
  columnCount: number; // rows imported, for display
}

export interface PlayerValue {
  sourceId: string;
  value: number;
}

export interface Player {
  id: string;
  matchKey: string; // normalizedName|position, used for cross-source merge + global tags
  name: string;
  team: string;
  position: string;
  bye: number | null;
  values: PlayerValue[];
  drafted: boolean;
  draftedAtPick: number | null;
}

export interface Board {
  id: string;
  name: string;
  platform: Platform;
  settings: LeagueSettings;
  currentPick: number;
  createdAt: string;
  sources: RankingSource[];
  players: Player[];
}

export type GlobalTags = Record<string, Tag>; // matchKey -> tag

export interface ImportRow {
  name: string;
  team: string;
  position: string;
  bye: number | null;
  value: number | null;
}

export const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"] as const;
