"use client";

import { useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { applyMapping, guessMapping, parseTable, type ColumnMapping } from "@/lib/csv";
import { readFileAsText } from "@/lib/download";
import type { SourceKind } from "@/lib/types";

const FIELD_LABELS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: "name", label: "Player name", required: true },
  { key: "team", label: "Team", required: false },
  { key: "position", label: "Position", required: false },
  { key: "bye", label: "Bye week", required: false },
  { key: "value", label: "Rank / ADP value", required: false },
];

export function ImportPanel({
  boardId,
  onClose,
}: {
  boardId: string;
  onClose: () => void;
}) {
  const importSource = useAppStore((s) => s.importSource);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sourceName, setSourceName] = useState("");
  const [kind, setKind] = useState<SourceKind>("rank");
  const [rawText, setRawText] = useState("");
  const [table, setTable] = useState<ReturnType<typeof parseTable> | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [result, setResult] = useState<{
    added: number;
    merged: number;
    fuzzyMerged: { name: string; matchedTo: string }[];
  } | null>(null);

  function parse(text: string) {
    setRawText(text);
    const t = parseTable(text);
    setTable(t);
    setMapping(guessMapping(t.headers));
    setResult(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readFileAsText(file);
    parse(text);
    e.target.value = "";
  }

  function handleConfirm() {
    if (!table || !mapping || !sourceName.trim()) return;
    const rows = applyMapping(table, mapping);
    const res = importSource(boardId, sourceName.trim(), kind, rows);
    setResult({
      added: res.added,
      merged: res.merged,
      fuzzyMerged: res.fuzzyMerged,
    });
  }

  return (
    <div className="mb-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">Import rankings</h3>
        <button
          onClick={onClose}
          className="text-sm text-zinc-500 hover:underline"
        >
          Close
        </button>
      </div>

      {result ? (
        <div className="text-sm">
          <p className="text-emerald-600 dark:text-emerald-400">
            Imported {result.added} new player{result.added === 1 ? "" : "s"}
            {result.merged > 0
              ? `, merged into ${result.merged} existing player${
                  result.merged === 1 ? "" : "s"
                }`
              : ""}
            .
          </p>
          {result.fuzzyMerged.length > 0 && (
            <div className="mt-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              <p className="mb-1 font-medium">
                Fuzzy-matched (double-check these):
              </p>
              <ul className="list-inside list-disc">
                {result.fuzzyMerged.map((f, i) => (
                  <li key={i}>
                    &ldquo;{f.name}&rdquo; matched to existing player &ldquo;
                    {f.matchedTo}&rdquo;
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                setTable(null);
                setMapping(null);
                setRawText("");
                setSourceName("");
                setResult(null);
              }}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Import another source
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Source label
              <input
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g. FantasyPros ECR, Draft Sharks, Sleeper ADP"
                className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Type
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as SourceKind)}
                className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="rank">Ranking (lower = better)</option>
                <option value="adp">ADP (average draft position)</option>
              </select>
            </label>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => parse(e.target.value)}
            placeholder="Paste a table copied from a rankings site here (name, team, position, rank/ADP columns)…"
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
          <p className="text-xs text-zinc-500">
            Detected {table.rows.length} row(s). Match each column below (we
            guessed based on the headers — double check before importing).
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {FIELD_LABELS.map(({ key, label, required }) => (
              <label key={key} className="flex flex-col gap-1 text-sm">
                {label}
                {required ? "" : " (optional)"}
                <select
                  value={mapping?.[key] ?? ""}
                  onChange={(e) =>
                    setMapping((m) =>
                      m
                        ? {
                            ...m,
                            [key]: e.target.value === "" ? null : parseInt(e.target.value, 10),
                          }
                        : m
                    )
                  }
                  className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">
                    {key === "value" ? "(use row order)" : "— none —"}
                  </option>
                  {table.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

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
              disabled={!sourceName.trim() || mapping?.name === null}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Import {table.rows.length} players
            </button>
            <button
              onClick={() => {
                setTable(null);
                setMapping(null);
              }}
              className="rounded-md px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              Back
            </button>
          </div>
          {!sourceName.trim() && (
            <p className="text-xs text-amber-600">
              Give this source a label above before importing.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
