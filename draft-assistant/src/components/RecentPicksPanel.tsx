"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import type { Board } from "@/lib/types";

export function RecentPicksPanel({
  board,
  autoAdvance,
}: {
  board: Board;
  autoAdvance: boolean;
}) {
  const setDrafted = useAppStore((s) => s.setDrafted);

  const recent = useMemo(
    () =>
      board.players
        .filter((p) => p.drafted && p.draftedAtPick !== null)
        .sort((a, b) => (b.draftedAtPick ?? 0) - (a.draftedAtPick ?? 0))
        .slice(0, 5),
    [board.players]
  );

  if (recent.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="mb-2 text-xs font-medium text-zinc-500">Recent picks</p>
      <ul className="flex flex-wrap gap-2">
        {recent.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-2 rounded-full bg-zinc-100 py-1 pl-3 pr-1 text-sm dark:bg-zinc-800"
          >
            <span className="text-zinc-400">#{p.draftedAtPick}</span>
            <span>{p.name}</span>
            {p.draftedByMe && (
              <span className="text-amber-500" title="Drafted by me">
                ⭐
              </span>
            )}
            <button
              onClick={() => setDrafted(board.id, p.id, false, autoAdvance)}
              title="Undo this pick"
              className="rounded-full px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-200 hover:text-red-600 dark:hover:bg-zinc-700"
            >
              Undo
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
