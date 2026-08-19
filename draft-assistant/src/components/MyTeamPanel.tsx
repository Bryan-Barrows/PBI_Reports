"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Board, RosterSlots } from "@/lib/types";
import { DEFAULT_ROSTER_SLOTS } from "@/lib/types";

const BASE_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"] as const;

function Pill({
  label,
  have,
  need,
}: {
  label: string;
  have: number;
  need: number;
}) {
  const filled = have >= need && need > 0;
  const empty = need === 0;
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${
        empty
          ? "bg-zinc-50 text-zinc-300 dark:bg-zinc-900 dark:text-zinc-700"
          : filled
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
      }`}
    >
      {label} {have}/{need}
    </span>
  );
}

export function MyTeamPanel({ board }: { board: Board }) {
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [expanded, setExpanded] = useState(false);
  const [editingSlots, setEditingSlots] = useState(false);

  const rosterSlots = board.settings.rosterSlots ?? DEFAULT_ROSTER_SLOTS;

  const myPlayers = useMemo(
    () => board.players.filter((p) => p.draftedByMe),
    [board.players]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const pos of BASE_POSITIONS) c[pos] = 0;
    for (const p of myPlayers) {
      if (c[p.position] !== undefined) c[p.position]++;
      else c[p.position] = (c[p.position] ?? 0) + 1;
    }
    return c;
  }, [myPlayers]);

  // FLEX is filled by RB/WR/TE surplus beyond their own base requirement.
  const flexHave = useMemo(() => {
    const surplus = (["RB", "WR", "TE"] as const).reduce(
      (sum, pos) => sum + Math.max(0, counts[pos] - rosterSlots[pos]),
      0
    );
    return Math.min(surplus, rosterSlots.FLEX);
  }, [counts, rosterSlots]);

  const totalNeed =
    rosterSlots.QB +
    rosterSlots.RB +
    rosterSlots.WR +
    rosterSlots.TE +
    rosterSlots.FLEX +
    rosterSlots.K +
    rosterSlots.DST +
    rosterSlots.BENCH;

  function updateSlot(key: keyof RosterSlots, value: number) {
    updateSettings(board.id, {
      ...board.settings,
      rosterSlots: { ...rosterSlots, [key]: Math.max(0, value) },
    });
  }

  return (
    <div className="mb-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-sm font-medium">
          My Team{" "}
          <span className="font-normal text-zinc-500">
            ({myPlayers.length}/{totalNeed})
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {BASE_POSITIONS.map((pos) => (
            <Pill key={pos} label={pos} have={counts[pos]} need={rosterSlots[pos]} />
          ))}
          <Pill label="FLEX" have={flexHave} need={rosterSlots.FLEX} />
          <span className="ml-2 text-xs text-zinc-400">{expanded ? "▴" : "▾"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
          {myPlayers.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No picks marked as yours yet — click the ⭐ next to a drafted
              player&rsquo;s checkbox to mark it as your pick.
            </p>
          ) : (
            <ul className="mb-3 flex flex-wrap gap-2 text-sm">
              {myPlayers.map((p) => (
                <li
                  key={p.id}
                  className="rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-800"
                >
                  <span className="text-zinc-500">{p.position}</span> {p.name}
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() => setEditingSlots((v) => !v)}
            className="text-xs text-zinc-500 hover:underline"
          >
            {editingSlots ? "Done editing roster" : "Edit roster slots"}
          </button>

          {editingSlots && (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
              {(Object.keys(rosterSlots) as (keyof RosterSlots)[]).map((key) => (
                <label key={key} className="flex flex-col gap-1 text-xs">
                  {key}
                  <input
                    type="number"
                    min={0}
                    value={rosterSlots[key]}
                    onChange={(e) =>
                      updateSlot(key, parseInt(e.target.value, 10) || 0)
                    }
                    className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
