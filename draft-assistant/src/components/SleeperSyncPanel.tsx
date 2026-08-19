"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Board } from "@/lib/types";
import {
  getSleeperDraft,
  getSleeperPicks,
  parseDraftIdInput,
  pickToNamePosition,
  resolveSleeperUserId,
} from "@/lib/sleeper";

const POLL_INTERVAL_MS = 12_000;

export function SleeperSyncPanel({ board }: { board: Board }) {
  const updateSleeperSync = useAppStore((s) => s.updateSleeperSync);
  const applySleeperPicks = useAppStore((s) => s.applySleeperPicks);

  const sync = board.sleeperSync;
  const [draftIdInput, setDraftIdInput] = useState(sync?.draftId ?? "");
  const [usernameInput, setUsernameInput] = useState(sync?.username ?? "");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ matched: number; unmatched: number } | null>(
    null
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function runSync(draftId: string) {
    try {
      const picks = await getSleeperPicks(draftId);
      const rows = picks
        .map((pick) => {
          const np = pickToNamePosition(pick);
          return np
            ? { name: np.name, position: np.position, slot: pick.draft_slot, pickNo: pick.pick_no }
            : null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      const result = applySleeperPicks(board.id, rows);
      setStatus(result);
      setError(null);
    } catch {
      setError("Couldn't reach Sleeper — will retry.");
    }
  }

  // Poll while sync is enabled for this board.
  useEffect(() => {
    if (!sync?.enabled || !sync.draftId) return;

    queueMicrotask(() => runSync(sync.draftId));
    intervalRef.current = setInterval(() => runSync(sync.draftId), POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync?.enabled, sync?.draftId, board.id]);

  async function handleConnect() {
    const draftId = parseDraftIdInput(draftIdInput);
    if (!draftId) {
      setError("Enter a draft ID or paste the draft room URL.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      let mySlot: number | null = null;
      if (usernameInput.trim()) {
        const userId = await resolveSleeperUserId(usernameInput.trim());
        const draft = await getSleeperDraft(draftId);
        mySlot = draft.draft_order?.[userId] ?? null;
      }
      updateSleeperSync(board.id, {
        draftId,
        username: usernameInput.trim(),
        mySlot,
        enabled: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't connect to that draft.");
    } finally {
      setConnecting(false);
    }
  }

  function handleStop() {
    updateSleeperSync(board.id, { enabled: false });
    setStatus(null);
  }

  return (
    <div className="mb-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="mb-2 text-sm font-medium">Live sync from Sleeper</p>

      {!sync?.enabled ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-zinc-500">
            Paste your Sleeper draft room URL (or just the draft ID) and your
            Sleeper username, and picks will be marked automatically as they
            happen — no manual clicking. Username is optional, but needed to
            auto-mark which picks are yours (⭐).
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={draftIdInput}
              onChange={(e) => setDraftIdInput(e.target.value)}
              placeholder="Draft URL or ID, e.g. https://sleeper.com/draft/nfl/123..."
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Your Sleeper username (optional)"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {connecting ? "Connecting…" : "Connect & start syncing"}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            Syncing every {POLL_INTERVAL_MS / 1000}s
          </span>
          <span className="text-zinc-500">
            {sync.lastSyncedPickCount} pick{sync.lastSyncedPickCount === 1 ? "" : "s"} synced
            {status ? ` (${status.matched} matched${status.unmatched ? `, ${status.unmatched} unmatched` : ""})` : ""}
            {sync.mySlot !== null ? ` · you're slot #${sync.mySlot}` : " · your slot unknown (no username set)"}
          </span>
          <button
            onClick={handleStop}
            className="rounded-md border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Stop syncing
          </button>
          {error && <p className="w-full text-xs text-amber-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
