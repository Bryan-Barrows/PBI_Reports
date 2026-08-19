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

// Roster slot targets used by the "My Team" panel to show what you still
// need. FLEX is filled by RB/WR/TE surplus beyond their own slot counts.
export interface RosterSlots {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  K: number;
  DST: number;
  BENCH: number;
}

export const DEFAULT_ROSTER_SLOTS: RosterSlots = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  K: 1,
  DST: 1,
  BENCH: 6,
};

export interface LeagueSettings {
  teams: number;
  scoring: Scoring;
  superflex: boolean;
  dynasty: boolean;
  rosterSlots: RosterSlots;
}

export interface SleeperSyncConfig {
  draftId: string;
  username: string;
  mySlot: number | null;
  enabled: boolean;
  lastSyncedAt: string | null;
  lastSyncedPickCount: number;
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
  draftedByMe: boolean;
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
  sleeperSync: SleeperSyncConfig | null;
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
