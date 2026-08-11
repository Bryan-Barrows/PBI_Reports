"use client";

import { useHydrated } from "@/lib/useHydrated";
import { useAppStore } from "@/lib/store";
import { Dashboard } from "./Dashboard";
import { BoardView } from "./BoardView";

export default function App() {
  const hydrated = useHydrated();
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const activeBoard = useAppStore((s) =>
    s.boards.find((b) => b.id === s.activeBoardId)
  );

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-400">
        Loading…
      </div>
    );
  }

  if (activeBoardId && activeBoard) {
    return <BoardView board={activeBoard} />;
  }

  return <Dashboard />;
}
