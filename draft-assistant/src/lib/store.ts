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
  SourceKind,
  Tag,
} from "./types";
import { mergeRowsIntoPlayers, type MergeResult } from "./merge";

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
  setCurrentPick: (boardId: string, pick: number) => void;

  exportBoard: (id: string) => string | null;
  importBoardFile: (json: string) => string | null;

  getBoard: (id: string) => Board | undefined;
}

const defaultSettings = (): LeagueSettings => ({
  teams: 12,
  scoring: "ppr",
  superflex: false,
  dynasty: false,
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
          currentPick: 1,
          createdAt: new Date().toISOString(),
          sources: [],
          players: [],
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
                  currentPick: 1,
                  players: b.players.map((p) => ({
                    ...p,
                    drafted: false,
                    draftedAtPick: null,
                  })),
                }
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
            const nextPick =
              drafted && autoAdvancePick ? b.currentPick + 1 : b.currentPick;
            return {
              ...b,
              currentPick: nextPick,
              players: b.players.map((p) =>
                p.id === playerId
                  ? {
                      ...p,
                      drafted,
                      draftedAtPick: drafted ? b.currentPick : null,
                    }
                  : p
              ),
            };
          }),
        }));
      },

      setCurrentPick: (boardId, pick) => {
        set((state) => ({
          boards: state.boards.map((b) =>
            b.id === boardId ? { ...b, currentPick: Math.max(1, pick) } : b
          ),
        }));
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
    }
  )
);
