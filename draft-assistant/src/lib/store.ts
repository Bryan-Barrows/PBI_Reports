import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { v4 as uuid } from "uuid";
import type {
  Board,
  GlobalTags,
  ImportRow,
  LeagueSettings,
  Platform,
  RankingSource,
  SleeperSyncConfig,
  SourceKind,
  Tag,
} from "./types";
import {
  findPlayerByNamePosition,
  mergeRowsIntoPlayers,
  type MergeResult,
} from "./merge";

interface AppState {
  boards: Board[];
  activeBoardId: string | null;
  globalTags: GlobalTags;

  createBoard: (
    name: string,
    platform: Platform,
    settings: LeagueSettings
  ) => string;
  deleteBoard: (id: string) => void;
  duplicateBoard: (id: string, newName: string) => string | null;
  renameBoard: (id: string, name: string) => void;
  resetBoard: (id: string) => void;
  clearPlayers: (id: string) => void;
  updateSettings: (id: string, settings: LeagueSettings) => void;
  setActiveBoard: (id: string | null) => void;

  importSource: (
    boardId: string,
    sourceName: string,
    kind: SourceKind,
    rows: ImportRow[]
  ) => MergeResult;
  updateSource: (
    boardId: string,
    sourceId: string,
    rows: ImportRow[]
  ) => MergeResult;
  removeSource: (boardId: string, sourceId: string) => void;

  setTag: (matchKey: string, tag: Tag | null) => void;
  setDrafted: (
    boardId: string,
    playerId: string,
    drafted: boolean,
    autoAdvancePick: boolean
  ) => void;
  setDraftedByMe: (boardId: string, playerId: string, mine: boolean) => void;
  setCurrentPick: (boardId: string, pick: number) => void;

  updateSleeperSync: (
    boardId: string,
    config: Partial<SleeperSyncConfig> | null
  ) => void;
  applySleeperPicks: (
    boardId: string,
    picks: { name: string; position: string; slot: number; pickNo: number }[]
  ) => { matched: number; unmatched: number };

  exportBoard: (id: string) => string | null;
  importBoardFile: (json: string) => string | null;

  getBoard: (id: string) => Board | undefined;
}

const defaultSettings = (): LeagueSettings => ({
  teams: 12,
  scoring: "ppr",
  superflex: false,
  dynasty: false,
  rosterSlots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1, BENCH: 6 },
});

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      boards: [],
      activeBoardId: null,
      globalTags: {},

      createBoard: (name, platform, settings) => {
        const id = uuid();
        const board: Board = {
          id,
          name,
          platform,
          settings: settings ?? defaultSettings(),
          currentPick: 0,
          createdAt: new Date().toISOString(),
          sources: [],
          players: [],
          sleeperSync: null,
        };
        set((state) => ({
          boards: [...state.boards, board],
          activeBoardId: id,
        }));
        return id;
      },

      deleteBoard: (id) => {
        set((state) => ({
          boards: state.boards.filter((b) => b.id !== id),
          activeBoardId:
            state.activeBoardId === id ? null : state.activeBoardId,
        }));
      },

      duplicateBoard: (id, newName) => {
        const source = get().boards.find((b) => b.id === id);
        if (!source) return null;
        const newId = uuid();
        const copy: Board = {
          ...source,
          id: newId,
          name: newName,
          createdAt: new Date().toISOString(),
          players: source.players.map((p) => ({
            ...p,
            id: uuid(),
            values: [...p.values],
          })),
          sources: source.sources.map((s) => ({ ...s })),
          // Don't carry a live sync into the copy — duplicating shouldn't
          // silently start pulling picks into a second board.
          sleeperSync: null,
        };
        set((state) => ({ boards: [...state.boards, copy] }));
        return newId;
      },

      renameBoard: (id, name) => {
        set((state) => ({
          boards: state.boards.map((b) => (b.id === id ? { ...b, name } : b)),
        }));
      },

      resetBoard: (id) => {
        set((state) => ({
          boards: state.boards.map((b) =>
            b.id === id
              ? {
                  ...b,
                  currentPick: 0,
                  players: b.players.map((p) => ({
                    ...p,
                    drafted: false,
                    draftedAtPick: null,
                    draftedByMe: false,
                  })),
                }
              : b
          ),
        }));
      },

      // Wipes all players AND sources on a board, plus its pick counter —
      // for starting a completely fresh merge after fixing up source files
      // (e.g. cleaned-up names), rather than matching against a pool built
      // from before the fix. Tags are untouched since they live outside the
      // board, keyed by player identity.
      clearPlayers: (id) => {
        set((state) => ({
          boards: state.boards.map((b) =>
            b.id === id
              ? { ...b, players: [], sources: [], currentPick: 0 }
              : b
          ),
        }));
      },

      updateSettings: (id, settings) => {
        set((state) => ({
          boards: state.boards.map((b) =>
            b.id === id ? { ...b, settings } : b
          ),
        }));
      },

      setActiveBoard: (id) => set({ activeBoardId: id }),

      importSource: (boardId, sourceName, kind, rows) => {
        const board = get().boards.find((b) => b.id === boardId);
        if (!board) {
          return { players: [], added: 0, merged: 0, fuzzyMerged: [] };
        }
        const sourceId = uuid();
        const result = mergeRowsIntoPlayers(board.players, rows, sourceId);
        const source: RankingSource = {
          id: sourceId,
          name: sourceName,
          kind,
          importedAt: new Date().toISOString(),
          columnCount: rows.length,
        };
        set((state) => ({
          boards: state.boards.map((b) =>
            b.id === boardId
              ? { ...b, players: result.players, sources: [...b.sources, source] }
              : b
          ),
        }));
        return result;
      },

      // Re-imports fresh rows into an existing source (same id, name, kind),
      // replacing its previous values wholesale. Unlike removeSource, this
      // never drops a player row — a player who no longer appears in the
      // refreshed list just shows "—" for this source, keeping their tags,
      // drafted status, and other sources' values intact.
      updateSource: (boardId, sourceId, rows) => {
        const board = get().boards.find((b) => b.id === boardId);
        const existingSource = board?.sources.find((s) => s.id === sourceId);
        if (!board || !existingSource) {
          return { players: [], added: 0, merged: 0, fuzzyMerged: [] };
        }
        const stripped = board.players.map((p) => ({
          ...p,
          values: p.values.filter((v) => v.sourceId !== sourceId),
        }));
        const result = mergeRowsIntoPlayers(stripped, rows, sourceId);
        set((state) => ({
          boards: state.boards.map((b) =>
            b.id === boardId
              ? {
                  ...b,
                  players: result.players,
                  sources: b.sources.map((s) =>
                    s.id === sourceId
                      ? {
                          ...s,
                          importedAt: new Date().toISOString(),
                          columnCount: rows.length,
                        }
                      : s
                  ),
                }
              : b
          ),
        }));
        return result;
      },

      // Removing a source only strips its values from players — it never
      // deletes a player row, even if that leaves them with zero remaining
      // source values, so drafted/tagged state is never silently lost.
      removeSource: (boardId, sourceId) => {
        set((state) => ({
          boards: state.boards.map((b) =>
            b.id === boardId
              ? {
                  ...b,
                  sources: b.sources.filter((s) => s.id !== sourceId),
                  players: b.players.map((p) => ({
                    ...p,
                    values: p.values.filter((v) => v.sourceId !== sourceId),
                  })),
                }
              : b
          ),
        }));
      },

      setTag: (matchKey, tag) => {
        set((state) => {
          const next = { ...state.globalTags };
          if (tag === null) {
            delete next[matchKey];
          } else {
            next[matchKey] = tag;
          }
          return { globalTags: next };
        });
      },

      setDrafted: (boardId, playerId, drafted, autoAdvancePick) => {
        set((state) => ({
          boards: state.boards.map((b) => {
            if (b.id !== boardId) return b;
            // Mirror the increment: un-marking a player should give the pick
            // back, or the counter drifts out of sync with the checkboxes.
            const nextPick = !autoAdvancePick
              ? b.currentPick
              : drafted
              ? b.currentPick + 1
              : Math.max(0, b.currentPick - 1);
            return {
              ...b,
              currentPick: nextPick,
              players: b.players.map((p) =>
                p.id === playerId
                  ? {
                      ...p,
                      drafted,
                      draftedAtPick: drafted ? nextPick : null,
                      // Un-drafting clears "mine" too — a player who's back
                      // on the board was never actually taken by your team.
                      draftedByMe: drafted ? p.draftedByMe : false,
                    }
                  : p
              ),
            };
          }),
        }));
      },

      setDraftedByMe: (boardId, playerId, mine) => {
        set((state) => ({
          boards: state.boards.map((b) =>
            b.id === boardId
              ? {
                  ...b,
                  players: b.players.map((p) =>
                    p.id === playerId ? { ...p, draftedByMe: mine } : p
                  ),
                }
              : b
          ),
        }));
      },

      setCurrentPick: (boardId, pick) => {
        set((state) => ({
          boards: state.boards.map((b) =>
            b.id === boardId ? { ...b, currentPick: Math.max(0, pick) } : b
          ),
        }));
      },

      updateSleeperSync: (boardId, config) => {
        set((state) => ({
          boards: state.boards.map((b) => {
            if (b.id !== boardId) return b;
            if (config === null) return { ...b, sleeperSync: null };
            return {
              ...b,
              sleeperSync: {
                draftId: b.sleeperSync?.draftId ?? "",
                username: b.sleeperSync?.username ?? "",
                mySlot: b.sleeperSync?.mySlot ?? null,
                enabled: b.sleeperSync?.enabled ?? false,
                lastSyncedAt: b.sleeperSync?.lastSyncedAt ?? null,
                lastSyncedPickCount: b.sleeperSync?.lastSyncedPickCount ?? 0,
                ...config,
              },
            };
          }),
        }));
      },

      // Applies a live Sleeper draft's picks (already-happened picks, in
      // pick order) onto the board: matches each pick to an existing player
      // by name+position, marks it drafted (and "mine" if the pick's slot
      // matches your configured slot), and advances currentPick to the true
      // pick count — safe to call repeatedly on every poll since already-
      // drafted players are left alone.
      applySleeperPicks: (boardId, picks) => {
        const board = get().boards.find((b) => b.id === boardId);
        if (!board) return { matched: 0, unmatched: 0 };

        const mySlot = board.sleeperSync?.mySlot ?? null;
        const players = board.players.map((p) => ({ ...p }));
        let matched = 0;
        let unmatched = 0;

        for (const pick of picks) {
          const target = findPlayerByNamePosition(players, pick.name, pick.position);
          if (target && !target.drafted) {
            target.drafted = true;
            target.draftedByMe = mySlot !== null && pick.slot === mySlot;
            target.draftedAtPick = pick.pickNo;
            matched++;
          } else if (!target) {
            unmatched++;
          }
        }

        set((state) => ({
          boards: state.boards.map((b) =>
            b.id === boardId
              ? {
                  ...b,
                  players,
                  currentPick: Math.max(b.currentPick, picks.length),
                  sleeperSync: b.sleeperSync
                    ? {
                        ...b.sleeperSync,
                        lastSyncedAt: new Date().toISOString(),
                        lastSyncedPickCount: picks.length,
                      }
                    : b.sleeperSync,
                }
              : b
          ),
        }));

        return { matched, unmatched };
      },

      exportBoard: (id) => {
        const board = get().boards.find((b) => b.id === id);
        if (!board) return null;
        const tags: GlobalTags = {};
        for (const p of board.players) {
          const t = get().globalTags[p.matchKey];
          if (t) tags[p.matchKey] = t;
        }
        return JSON.stringify({ board, tags }, null, 2);
      },

      importBoardFile: (json) => {
        try {
          const parsed = JSON.parse(json) as { board: Board; tags: GlobalTags };
          const newId = uuid();
          const board: Board = { ...parsed.board, id: newId };
          set((state) => ({
            boards: [...state.boards, board],
            globalTags: { ...state.globalTags, ...(parsed.tags || {}) },
          }));
          return newId;
        } catch {
          return null;
        }
      },

      getBoard: (id) => get().boards.find((b) => b.id === id),
    }),
    {
      name: "ff-draft-assistant-storage",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // Backfills fields added after a user's board was first saved (My
      // Team / Sleeper sync additions), so existing boards from earlier
      // versions of the app don't crash on load with missing data.
      merge: (persisted, current) => {
        const state = persisted as Partial<AppState> | undefined;
        if (!state?.boards) return { ...current, ...state };
        const boards = state.boards.map((b) => ({
          ...b,
          sleeperSync: b.sleeperSync ?? null,
          settings: {
            ...b.settings,
            rosterSlots: b.settings?.rosterSlots ?? defaultSettings().rosterSlots,
          },
          players: (b.players ?? []).map((p) => ({
            ...p,
            draftedByMe: p.draftedByMe ?? false,
          })),
        }));
        return { ...current, ...state, boards };
      },
    }
  )
);
