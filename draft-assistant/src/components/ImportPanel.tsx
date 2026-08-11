"use client";

import { useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { applyMapping, guessMapping, parseTable } from "@/lib/csv";
import { readFileAsText } from "@/lib/download";
import type { RankingSource, SourceKind } from "@/lib/types";

interface IdentityMapping {
  name: number | null;
  team: number | null;
  position: number | null;
  bye: number | null;
}

const IDENTITY_FIELDS: {
  key: keyof IdentityMapping;
  label: string;
  required: boolean;
}[] = [
  { key: "name", label: "Player name", required: true },
  { key: "team", label: "Team", required: false },
  { key: "position", label: "Position", required: false },
  { key: "bye", label: "Bye week", required: false },
];

// One entry per ranking/ADP column the pasted table contains — lets one
// combined table (e.g. your own master sheet with a column per site) become
// several sources in a single import instead of one paste per source.
interface SourceColumn {
  key: string;
  columnIndex: number | null; // null = use row order
  label: string;
  kind: SourceKind;
}

interface SourceResult {
  label: string;
  added: number;
  merged: number;
  fuzzyMerged: { name: string; matchedTo: string }[];
}

function randomId() {
  return Math.random().toString(36).slice(2);
}

export function ImportPanel({
  boardId,
  existingSource,
  onClose,
}: {
  boardId: string;
  existingSource?: RankingSource;
  onClose: () => void;
}) {
  const importSource = useAppStore((s) => s.importSource);
  const updateSource = useAppStore((s) => s.updateSource);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUpdate = !!existingSource;

  const [rawText, setRawText] = useState("");
  const [table, setTable] = useState<ReturnType<typeof parseTable> | null>(null);
  const [identity, setIdentity] = useState<IdentityMapping>({
    name: null,
    team: null,
    position: null,
    bye: null,
  });
  const [updateValueColumn, setUpdateValueColumn] = useState<number | null>(null);
  const [sourceColumns, setSourceColumns] = useState<SourceColumn[]>([]);
  const [results, setResults] = useState<SourceResult[] | null>(null);

  function parse(text: string) {
    setRawText(text);
    const t = parseTable(text);
    const guess = guessMapping(t.headers);
    setTable(t);
    setIdentity({
      name: guess.name,
      team: guess.team,
      position: guess.position,
      bye: guess.bye,
    });
    if (isUpdate) {
      setUpdateValueColumn(guess.value);
    } else {
      setSourceColumns([
        { key: randomId(), columnIndex: guess.value, label: "", kind: "rank" },
      ]);
    }
    setResults(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readFileAsText(file);
    parse(text);
    e.target.value = "";
  }

  function resetToStart() {
    setTable(null);
    setRawText("");
    setSourceColumns([]);
    setResults(null);
  }

  function handleConfirm() {
    if (!table) return;
    const base = identity;

    if (isUpdate && existingSource) {
      const rows = applyMapping(table, { ...base, value: updateValueColumn });
      const res = updateSource(boardId, existingSource.id, rows);
      setResults([
        {
          label: existingSource.name,
          added: res.added,
          merged: res.merged,
          fuzzyMerged: res.fuzzyMerged,
        },
      ]);
      return;
    }

    const valid = sourceColumns.filter((sc) => sc.label.trim());
    const collected: SourceResult[] = valid.map((sc) => {
      const rows = applyMapping(table, { ...base, value: sc.columnIndex });
      const res = importSource(boardId, sc.label.trim(), sc.kind, rows);
      return {
        label: sc.label.trim(),
        added: res.added,
        merged: res.merged,
        fuzzyMerged: res.fuzzyMerged,
      };
    });
    setResults(collected);
  }

  const canConfirm = isUpdate
    ? true
    : identity.name !== null && sourceColumns.some((sc) => sc.label.trim());

  return (
    <div className="mb-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">
          {isUpdate ? `Update "${existingSource?.name}"` : "Import rankings"}
        </h3>
        <button onClick={onClose} className="text-sm text-zinc-500 hover:underline">
          Close
        </button>
      </div>
      {isUpdate && !results && (
        <p className="mb-3 text-xs text-zinc-500">
          Paste or upload the refreshed table below. It replaces this
          source&rsquo;s values only — other sources, tags, and drafted status
          are untouched, and no player rows are deleted.
        </p>
      )}
      {!isUpdate && !table && (
        <p className="mb-3 text-xs text-zinc-500">
          One table works for multiple sources — e.g. a sheet with a name
          column plus a rank column per site. You&rsquo;ll pick which columns
          are which source next.
        </p>
      )}

      {results ? (
        <div className="text-sm">
          {results.map((r, i) => (
            <div key={i} className="mb-2">
              <p className="text-emerald-600 dark:text-emerald-400">
                {results.length > 1 && <strong>{r.label}: </strong>}
                {isUpdate ? "Updated" : "Imported"} {r.added} new player
                {r.added === 1 ? "" : "s"}
                {r.merged > 0
                  ? `, ${isUpdate ? "refreshed" : "merged into"} ${r.merged} existing player${
                      r.merged === 1 ? "" : "s"
                    }`
                  : ""}
                .
              </p>
              {r.fuzzyMerged.length > 0 && (
                <div className="mt-1 rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  <p className="mb-1 font-medium">
                    Fuzzy-matched (double-check these):
                  </p>
                  <ul className="list-inside list-disc">
                    {r.fuzzyMerged.map((f, j) => (
                      <li key={j}>
                        &ldquo;{f.name}&rdquo; matched to existing player
                        &ldquo;{f.matchedTo}&rdquo;
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          <div className="mt-3 flex gap-2">
            <button
              onClick={resetToStart}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {isUpdate ? "Paste again" : "Import another table"}
            </button>
            <button
              onClick={onClose}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Done
            </button>
          </div>
        </div>
      ) : !table ? (
        <div className="flex flex-col gap-3">
          {isUpdate && (
            <p className="text-sm text-zinc-500">
              Source:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {existingSource?.name}
              </span>{" "}
              ({existingSource?.kind === "adp" ? "ADP" : "ranking"})
            </p>
          )}
          <textarea
            value={rawText}
            onChange={(e) => parse(e.target.value)}
            placeholder="Paste a table copied from a rankings site (or your own sheet) here…"
            rows={6}
            className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-400">or</span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Upload CSV file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-500">
              Player identity columns
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              {IDENTITY_FIELDS.map(({ key, label, required }) => (
                <label key={key} className="flex flex-col gap-1 text-sm">
                  {label}
                  {required ? "" : " (optional)"}
                  <select
                    value={identity[key] ?? ""}
                    onChange={(e) =>
                      setIdentity((m) => ({
                        ...m,
                        [key]: e.target.value === "" ? null : parseInt(e.target.value, 10),
                      }))
                    }
                    className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="">— none —</option>
                    {table.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          {isUpdate ? (
            <label className="flex max-w-xs flex-col gap-1 text-sm">
              Rank / ADP value column
              <select
                value={updateValueColumn ?? ""}
                onChange={(e) =>
                  setUpdateValueColumn(
                    e.target.value === "" ? null : parseInt(e.target.value, 10)
                  )
                }
                className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">(use row order)</option>
                {table.headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h || `Column ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">
                Ranking / ADP columns — one per source
              </p>
              <div className="flex flex-col gap-2">
                {sourceColumns.map((sc) => (
                  <div
                    key={sc.key}
                    className="grid grid-cols-1 gap-2 rounded-md border border-zinc-200 p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end dark:border-zinc-800"
                  >
                    <label className="flex flex-col gap-1 text-sm">
                      Column
                      <select
                        value={sc.columnIndex ?? ""}
                        onChange={(e) =>
                          setSourceColumns((list) =>
                            list.map((x) =>
                              x.key === sc.key
                                ? {
                                    ...x,
                                    columnIndex:
                                      e.target.value === ""
                                        ? null
                                        : parseInt(e.target.value, 10),
                                  }
                                : x
                            )
                          )
                        }
                        className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <option value="">(use row order)</option>
                        {table.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Column ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Source label
                      <input
                        value={sc.label}
                        onChange={(e) =>
                          setSourceColumns((list) =>
                            list.map((x) =>
                              x.key === sc.key ? { ...x, label: e.target.value } : x
                            )
                          )
                        }
                        placeholder="e.g. FantasyPros ECR"
                        className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Type
                      <select
                        value={sc.kind}
                        onChange={(e) =>
                          setSourceColumns((list) =>
                            list.map((x) =>
                              x.key === sc.key
                                ? { ...x, kind: e.target.value as SourceKind }
                                : x
                            )
                          )
                        }
                        className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <option value="rank">Rank</option>
                        <option value="adp">ADP</option>
                      </select>
                    </label>
                    <button
                      onClick={() =>
                        setSourceColumns((list) => list.filter((x) => x.key !== sc.key))
                      }
                      className="rounded-md px-2 py-2 text-sm text-zinc-400 hover:text-red-500"
                      title="Remove this source column"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  setSourceColumns((list) => [
                    ...list,
                    { key: randomId(), columnIndex: null, label: "", kind: "rank" },
                  ])
                }
                className="mt-2 rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                + Add another ranking/ADP column
              </button>
            </div>
          )}

          <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  {table.headers.map((h, i) => (
                    <th key={i} className="px-2 py-1 text-left font-medium">
                      {h || `Col ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                    {row.map((cell, j) => (
                      <td key={j} className="px-2 py-1">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isUpdate
                ? `Update ${table.rows.length} players`
                : `Import ${table.rows.length} players into ${
                    sourceColumns.filter((sc) => sc.label.trim()).length
                  } source${sourceColumns.filter((sc) => sc.label.trim()).length === 1 ? "" : "s"}`}
            </button>
            <button
              onClick={() => setTable(null)}
              className="rounded-md px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              Back
            </button>
          </div>
          {!canConfirm && (
            <p className="text-xs text-amber-600">
              {identity.name === null
                ? "Map the player name column above."
                : "Give at least one ranking/ADP column a label before importing."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
