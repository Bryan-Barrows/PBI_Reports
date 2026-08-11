"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Board, Player, Tag } from "@/lib/types";
import { POSITIONS } from "@/lib/types";
import { computeConsensusAndAdp, adpProximity } from "@/lib/derive";

const TAG_META: Record<Tag, { label: string; emoji: string; active: string }> = {
  love: { label: "Love", emoji: "❤️", active: "bg-rose-100 dark:bg-rose-950 ring-1 ring-rose-400" },
  like: { label: "Like", emoji: "👍", active: "bg-emerald-100 dark:bg-emerald-950 ring-1 ring-emerald-400" },
  maybe: { label: "Maybe", emoji: "🤔", active: "bg-amber-100 dark:bg-amber-950 ring-1 ring-amber-400" },
  no: { label: "No", emoji: "🚫", active: "bg-zinc-200 dark:bg-zinc-800 ring-1 ring-zinc-400" },
};

type SortKey = "consensus" | "adp" | "name";

export function PlayerTable({ board }: { board: Board }) {
  const globalTags = useAppStore((s) => s.globalTags);
  const setTag = useAppStore((s) => s.setTag);
  const setDrafted = useAppStore((s) => s.setDrafted);

  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<string>("ALL");
  const [tagFilter, setTagFilter] = useState<string>("ALL");
  const [hideDrafted, setHideDrafted] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("consensus");

  const rows = useMemo(() => {
    let list = board.players.map((p) => {
      const { consensusRank, adp } = computeConsensusAndAdp(p, board.sources);
      const tag = globalTags[p.matchKey] ?? null;
      const proximity = p.drafted ? null : adpProximity(adp, board.currentPick);
      return { player: p, consensusRank, adp, tag, proximity };
    });

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.player.name.toLowerCase().includes(q));
    }
    if (position !== "ALL") {
      list = list.filter((r) => r.player.position === position);
    }
    if (tagFilter !== "ALL") {
      list = list.filter((r) =>
        tagFilter === "UNTAGGED" ? !r.tag : r.tag === tagFilter
      );
    }
    if (hideDrafted) {
      list = list.filter((r) => !r.player.drafted);
    }

    list.sort((a, b) => {
      if (a.player.drafted !== b.player.drafted) {
        return a.player.drafted ? 1 : -1;
      }
      if (sortKey === "name") return a.player.name.localeCompare(b.player.name);
      const key = sortKey === "adp" ? "adp" : "consensusRank";
      const av = a[key];
      const bv = b[key];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return av - bv;
    });

    return list;
  }, [board, globalTags, search, position, tagFilter, hideDrafted, sortKey]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search player…"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="ALL">All positions</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="ALL">All tags</option>
          <option value="love">❤️ Love</option>
          <option value="like">👍 Like</option>
          <option value="maybe">🤔 Maybe</option>
          <option value="no">🚫 No</option>
          <option value="UNTAGGED">Untagged</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="consensus">Sort: Consensus rank</option>
          <option value="adp">Sort: ADP</option>
          <option value="name">Sort: Name</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={hideDrafted}
            onChange={(e) => setHideDrafted(e.target.checked)}
          />
          Hide drafted
        </label>
        <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={autoAdvance}
            onChange={(e) => setAutoAdvance(e.target.checked)}
          />
          Auto-advance pick on draft
        </label>
        <span className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-rose-200 dark:bg-rose-900" /> ADP
            within 5
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-amber-100 dark:bg-amber-950" /> ADP
            within 10
          </span>
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2">Pos</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Bye</th>
              {board.sources.map((s) => (
                <th key={s.id} className="px-3 py-2 whitespace-nowrap">
                  {s.name}
                </th>
              ))}
              <th className="px-3 py-2">Consensus</th>
              <th className="px-3 py-2">ADP</th>
              <th className="px-3 py-2">Tag</th>
              <th className="px-3 py-2">Drafted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player, consensusRank, adp, tag, proximity }) => (
              <PlayerRow
                key={player.id}
                player={player}
                consensusRank={consensusRank}
                adp={adp}
                tag={tag}
                proximity={proximity}
                sources={board.sources}
                onTag={(t) => setTag(player.matchKey, tag === t ? null : t)}
                onDraft={(drafted) =>
                  setDrafted(board.id, player.id, drafted, autoAdvance)
                }
              />
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6 + board.sources.length}
                  className="px-3 py-8 text-center text-zinc-400"
                >
                  No players match. Import some rankings to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  consensusRank,
  adp,
  tag,
  proximity,
  sources,
  onTag,
  onDraft,
}: {
  player: Player;
  consensusRank: number | null;
  adp: number | null;
  tag: Tag | null;
  proximity: "hot" | "warm" | null;
  sources: Board["sources"];
  onTag: (t: Tag) => void;
  onDraft: (drafted: boolean) => void;
}) {
  const rowClass = player.drafted
    ? "opacity-40 line-through"
    : proximity === "hot"
    ? "bg-rose-50 dark:bg-rose-950/40"
    : proximity === "warm"
    ? "bg-amber-50 dark:bg-amber-950/30"
    : "";

  return (
    <tr className={`border-t border-zinc-100 dark:border-zinc-800 ${rowClass}`}>
      <td className="px-3 py-2 font-medium">{player.name}</td>
      <td className="px-3 py-2 text-zinc-500">{player.position}</td>
      <td className="px-3 py-2 text-zinc-500">{player.team || "—"}</td>
      <td className="px-3 py-2 text-zinc-500">{player.bye ?? "—"}</td>
      {sources.map((s) => {
        const v = player.values.find((val) => val.sourceId === s.id);
        return (
          <td key={s.id} className="px-3 py-2 text-zinc-500">
            {v ? v.value : "—"}
          </td>
        );
      })}
      <td className="px-3 py-2 font-medium">
        {consensusRank !== null ? consensusRank.toFixed(1) : "—"}
      </td>
      <td className="px-3 py-2 font-medium">
        {adp !== null ? adp.toFixed(1) : "—"}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          {(Object.keys(TAG_META) as Tag[]).map((t) => (
            <button
              key={t}
              title={TAG_META[t].label}
              onClick={() => onTag(t)}
              className={`rounded px-1.5 py-0.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                tag === t ? TAG_META[t].active : ""
              }`}
            >
              {TAG_META[t].emoji}
            </button>
          ))}
        </div>
      </td>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={player.drafted}
          onChange={(e) => onDraft(e.target.checked)}
        />
      </td>
    </tr>
  );
}
