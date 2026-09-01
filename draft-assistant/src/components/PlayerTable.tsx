"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Board, Player, Tag } from "@/lib/types";
import { POSITIONS } from "@/lib/types";
import { computeConsensusAndAdp, adpProximity } from "@/lib/derive";

// `stripe` is a left-border accent, not a background fill, so it stacks
// cleanly with the ADP-proximity row background instead of competing with it.
const TAG_META: Record<
  Tag,
  { label: string; emoji: string; active: string; stripe: string }
> = {
  love: {
    label: "Love",
    emoji: "❤️",
    active: "bg-rose-100 dark:bg-rose-950 ring-1 ring-rose-400",
    stripe: "border-l-rose-500",
  },
  like: {
    label: "Like",
    emoji: "👍",
    active: "bg-emerald-100 dark:bg-emerald-950 ring-1 ring-emerald-400",
    stripe: "border-l-emerald-500",
  },
  maybe: {
    label: "Maybe",
    emoji: "🤔",
    active: "bg-amber-100 dark:bg-amber-950 ring-1 ring-amber-400",
    stripe: "border-l-amber-500",
  },
  no: {
    label: "No",
    emoji: "🚫",
    active: "bg-zinc-200 dark:bg-zinc-800 ring-1 ring-zinc-400",
    stripe: "border-l-zinc-400",
  },
};

// "consensus" | "adp" | "name" | "source:<sourceId>" — the source form lets
// any individual ranking column (not just the computed Consensus/ADP ones)
// be sorted on, via its column header or the dropdown.
type SortKey = string;
type SortDir = "asc" | "desc";

export function PlayerTable({
  board,
  autoAdvance,
  onAutoAdvanceChange,
}: {
  board: Board;
  autoAdvance: boolean;
  onAutoAdvanceChange: (value: boolean) => void;
}) {
  const globalTags = useAppStore((s) => s.globalTags);
  const setTag = useAppStore((s) => s.setTag);
  const setDrafted = useAppStore((s) => s.setDrafted);
  const setDraftedByMe = useAppStore((s) => s.setDraftedByMe);

  const [search, setSearch] = useState("");
  const [positions, setPositions] = useState<string[]>([]); // empty = all
  const [tagFilter, setTagFilter] = useState<string>("ALL");
  const [hideDrafted, setHideDrafted] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("consensus");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [requireAllRankSources, setRequireAllRankSources] = useState(true);

  // Clicking a header (or picking it from the dropdown) sorts by that
  // column; clicking the same one again flips direction.
  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // Only rank-type sources get their own column — an ADP-type source's
  // values already surface in the dedicated ADP summary column, so showing
  // them again as a named column is pure duplication.
  const rankSources = useMemo(
    () => board.sources.filter((s) => s.kind === "rank"),
    [board.sources]
  );
  const rankSourceIds = useMemo(
    () => rankSources.map((s) => s.id),
    [rankSources]
  );

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
    if (positions.length > 0) {
      list = list.filter((r) => positions.includes(r.player.position));
    }
    if (tagFilter !== "ALL") {
      list = list.filter((r) =>
        tagFilter === "UNTAGGED" ? !r.tag : r.tag === tagFilter
      );
    }
    if (hideDrafted) {
      list = list.filter((r) => !r.player.drafted);
    }
    // Only show players ranked by every current rank-type source — e.g. if
    // you track 4 sites, a player missing from even one is left off, even
    // if they showed up in an ADP-only file.
    if (requireAllRankSources && rankSourceIds.length > 0) {
      list = list.filter((r) =>
        rankSourceIds.every((id) => r.player.values.some((v) => v.sourceId === id))
      );
    }

    const dirMult = sortDir === "asc" ? 1 : -1;
    const sourceId = sortKey.startsWith("source:") ? sortKey.slice(7) : null;

    list.sort((a, b) => {
      if (sortKey === "name") {
        return dirMult * a.player.name.localeCompare(b.player.name);
      }
      let av: number | null;
      let bv: number | null;
      if (sourceId) {
        av = a.player.values.find((v) => v.sourceId === sourceId)?.value ?? null;
        bv = b.player.values.find((v) => v.sourceId === sourceId)?.value ?? null;
      } else {
        const key = sortKey === "adp" ? "adp" : "consensusRank";
        av = a[key];
        bv = b[key];
      }
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return dirMult * (av - bv);
    });

    return list;
  }, [
    board,
    globalTags,
    search,
    positions,
    tagFilter,
    hideDrafted,
    sortKey,
    sortDir,
    requireAllRankSources,
    rankSourceIds,
  ]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search player…"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="flex items-center gap-1 rounded-md border border-zinc-300 px-1.5 py-1 dark:border-zinc-700">
          <button
            onClick={() => setPositions([])}
            className={`rounded px-1.5 py-0.5 text-xs ${
              positions.length === 0
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            All
          </button>
          {POSITIONS.map((p) => {
            const active = positions.includes(p);
            return (
              <button
                key={p}
                onClick={() =>
                  setPositions((prev) =>
                    active ? prev.filter((x) => x !== p) : [...prev, p]
                  )
                }
                className={`rounded px-1.5 py-0.5 text-xs ${
                  active
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
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
          onChange={(e) => handleSort(e.target.value)}
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="adp">Sort: ADP</option>
          <option value="consensus">Sort: Consensus rank</option>
          {rankSources.map((s) => (
            <option key={s.id} value={`source:${s.id}`}>
              Sort: {s.name}
            </option>
          ))}
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
        <label
          className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400"
          title="Hides any player missing a rank from one or more of your rank-type sources, regardless of ADP data"
        >
          <input
            type="checkbox"
            checked={requireAllRankSources}
            onChange={(e) => setRequireAllRankSources(e.target.checked)}
          />
          Only players ranked by all sources
        </label>
        <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={autoAdvance}
            onChange={(e) => onAutoAdvanceChange(e.target.checked)}
          />
          Auto-advance pick on draft
        </label>
        <span className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-rose-200 dark:bg-rose-900" /> ADP
            passed this pick
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-yellow-200 dark:bg-yellow-500/70" /> ADP
            within next 10
          </span>
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <SortableHeader label="Player" sortKeyValue="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="px-2 py-1.5">Pos</th>
              <th className="px-2 py-1.5">Team</th>
              <th className="px-2 py-1.5">Bye</th>
              <SortableHeader label="ADP" sortKeyValue="adp" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Consensus" sortKeyValue="consensus" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              {rankSources.map((s) => (
                <SortableHeader
                  key={s.id}
                  label={s.name}
                  sortKeyValue={`source:${s.id}`}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              ))}
              <th className="px-2 py-1.5">Tag</th>
              <th className="px-2 py-1.5">Drafted</th>
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
                sources={rankSources}
                onTag={(t) => setTag(player.matchKey, tag === t ? null : t)}
                onDraft={(drafted) =>
                  setDrafted(board.id, player.id, drafted, autoAdvance)
                }
                onSetMine={(mine) => setDraftedByMe(board.id, player.id, mine)}
              />
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6 + rankSources.length}
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

function SortableHeader({
  label,
  sortKeyValue,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  sortKeyValue: string;
  sortKey: string;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  const active = sortKey === sortKeyValue;
  return (
    <th className="px-2 py-1.5 whitespace-nowrap">
      <button
        onClick={() => onSort(sortKeyValue)}
        className={`flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 ${
          active ? "text-zinc-900 dark:text-zinc-100" : ""
        }`}
        title={`Sort by ${label}`}
      >
        {label}
        <span className="text-[10px] text-zinc-400">
          {active ? (sortDir === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
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
  onSetMine,
}: {
  player: Player;
  consensusRank: number | null;
  adp: number | null;
  tag: Tag | null;
  proximity: "hot" | "warm" | null;
  sources: Board["sources"];
  onTag: (t: Tag) => void;
  onDraft: (drafted: boolean) => void;
  onSetMine: (mine: boolean) => void;
}) {
  const bgClass = player.drafted
    ? "opacity-40 line-through"
    : proximity === "hot"
    ? "bg-rose-50 dark:bg-rose-950/40"
    : proximity === "warm"
    ? "bg-yellow-100 dark:bg-yellow-500/20"
    : "";
  // Left-edge stripe is a border, independent of the background above, so a
  // tagged player stays identifiable even on a red/yellow ADP-highlighted row.
  const stripeClass = tag ? TAG_META[tag].stripe : "border-l-transparent";

  return (
    <tr
      className={`border-t border-t-zinc-100 dark:border-t-zinc-800 border-l-4 ${stripeClass} ${bgClass}`}
    >
      <td className="px-2 py-1.5 font-medium whitespace-nowrap">
        {tag && <span title={TAG_META[tag].label}>{TAG_META[tag].emoji}</span>}{" "}
        {player.name}
      </td>
      <td className="px-2 py-1.5 text-zinc-500">{player.position}</td>
      <td className="px-2 py-1.5 text-zinc-500">{player.team || "—"}</td>
      <td className="px-2 py-1.5 text-zinc-500">{player.bye ?? "—"}</td>
      <td className="px-2 py-1.5 font-medium">
        {adp !== null ? adp.toFixed(1) : "—"}
      </td>
      <td className="px-2 py-1.5 font-medium">
        {consensusRank !== null ? consensusRank.toFixed(1) : "—"}
      </td>
      {sources.map((s) => {
        const v = player.values.find((val) => val.sourceId === s.id);
        return (
          <td key={s.id} className="px-2 py-1.5 text-zinc-500">
            {v ? v.value : "—"}
          </td>
        );
      })}
      <td className="px-2 py-1.5">
        <div className="flex gap-0.5">
          {(Object.keys(TAG_META) as Tag[]).map((t) => (
            <button
              key={t}
              title={TAG_META[t].label}
              onClick={() => onTag(t)}
              className={`rounded px-1 py-0.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                tag === t ? TAG_META[t].active : ""
              }`}
            >
              {TAG_META[t].emoji}
            </button>
          ))}
        </div>
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={player.drafted}
            onChange={(e) => onDraft(e.target.checked)}
          />
          {player.drafted && (
            <button
              onClick={() => onSetMine(!player.draftedByMe)}
              title={player.draftedByMe ? "Drafted by me — click to unmark" : "Mark as my pick"}
              className={`text-xs ${
                player.draftedByMe
                  ? "text-amber-500"
                  : "text-zinc-300 hover:text-amber-400 dark:text-zinc-600"
              }`}
            >
              ⭐
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
