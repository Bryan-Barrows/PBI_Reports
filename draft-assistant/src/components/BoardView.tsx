"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Board, RankingSource } from "@/lib/types";
import { ImportPanel } from "./ImportPanel";
import { PlayerTable } from "./PlayerTable";
import { MyTeamPanel } from "./MyTeamPanel";
import { RecentPicksPanel } from "./RecentPicksPanel";
import { SleeperSyncPanel } from "./SleeperSyncPanel";
import { downloadTextFile } from "@/lib/download";

export function BoardView({ board }: { board: Board }) {
  const setActiveBoard = useAppStore((s) => s.setActiveBoard);
  const setCurrentPick = useAppStore((s) => s.setCurrentPick);
  const resetBoard = useAppStore((s) => s.resetBoard);
  const clearPlayers = useAppStore((s) => s.clearPlayers);
  const removeSource = useAppStore((s) => s.removeSource);
  const exportBoard = useAppStore((s) => s.exportBoard);
  const renameBoard = useAppStore((s) => s.renameBoard);

  const [importTarget, setImportTarget] = useState<
    "new" | RankingSource | null
  >(board.sources.length === 0 ? "new" : null);
  const [autoAdvance, setAutoAdvance] = useState(true);

  return (
    <div className="mx-auto w-full max-w-[1800px] flex-1 px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            onClick={() => setActiveBoard(null)}
            className="mb-2 text-sm text-zinc-500 hover:underline"
          >
            ← All boards
          </button>
          <h1
            className="cursor-pointer text-xl font-semibold tracking-tight"
            title="Click to rename"
            onClick={() => {
              const newName = prompt("Rename board", board.name);
              if (newName) renameBoard(board.id, newName);
            }}
          >
            {board.name}
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            {board.settings.teams} teams · {board.settings.scoring.toUpperCase()}
            {board.settings.superflex ? " · Superflex" : ""}
            {board.settings.dynasty ? " · Dynasty" : ""}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 dark:border-zinc-700">
            <span className="text-xs text-zinc-500">Current pick</span>
            <button
              onClick={() => setCurrentPick(board.id, board.currentPick - 1)}
              className="rounded px-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              −
            </button>
            <input
              type="number"
              value={board.currentPick}
              onChange={(e) =>
                setCurrentPick(board.id, parseInt(e.target.value, 10) || 1)
              }
              className="w-14 rounded border border-zinc-200 px-1 py-0.5 text-center dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              onClick={() => setCurrentPick(board.id, board.currentPick + 1)}
              className="rounded px-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              +
            </button>
          </div>
          <button
            onClick={() => {
              if (confirm("Clear all drafted markers on this board? Tags and rankings are kept.")) {
                resetBoard(board.id);
              }
            }}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Reset board
          </button>
          <button
            onClick={() => {
              if (
                confirm(
                  `Remove ALL players and rankings sources on "${board.name}"? This can't be undone — you'll re-import everything from scratch. Your Love/Like/Maybe/No tags are kept.`
                )
              ) {
                clearPlayers(board.id);
                setImportTarget("new");
              }
            }}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
          >
            Clear all rankings
          </button>
          <button
            onClick={() => {
              const json = exportBoard(board.id);
              if (json) downloadTextFile(`${board.name.replace(/\s+/g, "-")}.json`, json);
            }}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Export
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {board.sources.map((s) => (
          <span
            key={s.id}
            className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {s.name}
            <span className="text-zinc-400">
              ({s.kind === "adp" ? "ADP" : "rank"})
            </span>
            <button
              onClick={() => setImportTarget(s)}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100"
              title="Update this source's values"
            >
              ↻
            </button>
            <button
              onClick={() => {
                if (confirm(`Remove source "${s.name}"? Player rows are kept — this only clears their values for this source.`)) {
                  removeSource(board.id, s.id);
                }
              }}
              className="text-zinc-400 hover:text-red-500"
              title="Remove this source"
            >
              ×
            </button>
          </span>
        ))}
        <button
          onClick={() => setImportTarget((v) => (v ? null : "new"))}
          className="rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          + Add rankings source
        </button>
      </div>

      {importTarget && (
        <ImportPanel
          board={board}
          existingSource={importTarget === "new" ? undefined : importTarget}
          onClose={() => setImportTarget(null)}
        />
      )}

      <MyTeamPanel board={board} />
      <RecentPicksPanel board={board} autoAdvance={autoAdvance} />
      {board.platform === "sleeper" && <SleeperSyncPanel board={board} />}

      <PlayerTable
        board={board}
        autoAdvance={autoAdvance}
        onAutoAdvanceChange={setAutoAdvance}
      />
    </div>
  );
}
