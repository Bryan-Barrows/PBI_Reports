"use client";

import { useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Platform, Scoring } from "@/lib/types";
import { downloadTextFile, readFileAsText } from "@/lib/download";

const PLATFORM_LABEL: Record<Platform, string> = {
  sleeper: "Sleeper",
  fleaflicker: "Fleaflicker",
  other: "Other",
};

export function Dashboard() {
  const boards = useAppStore((s) => s.boards);
  const createBoard = useAppStore((s) => s.createBoard);
  const deleteBoard = useAppStore((s) => s.deleteBoard);
  const duplicateBoard = useAppStore((s) => s.duplicateBoard);
  const resetBoard = useAppStore((s) => s.resetBoard);
  const setActiveBoard = useAppStore((s) => s.setActiveBoard);
  const exportBoard = useAppStore((s) => s.exportBoard);
  const importBoardFile = useAppStore((s) => s.importBoardFile);

  const [showForm, setShowForm] = useState(boards.length === 0);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<Platform>("sleeper");
  const [teams, setTeams] = useState(12);
  const [scoring, setScoring] = useState<Scoring>("ppr");
  const [superflex, setSuperflex] = useState(false);
  const [dynasty, setDynasty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createBoard(name.trim(), platform, {
      teams,
      scoring,
      superflex,
      dynasty,
    });
    setName("");
    setShowForm(false);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readFileAsText(file);
    const id = importBoardFile(text);
    if (!id) alert("Couldn't read that file — is it a board export?");
    e.target.value = "";
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            🏈 Draft Assistant
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Your draft boards. Each one keeps its own drafted players, pick
            number, and imported rankings.
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + New Draft Board
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Import Board File
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Board name
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sleeper League 2026"
                className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Platform
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="sleeper">Sleeper</option>
                <option value="fleaflicker">Fleaflicker</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Teams
              <input
                type="number"
                min={2}
                max={32}
                value={teams}
                onChange={(e) => setTeams(parseInt(e.target.value, 10) || 12)}
                className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Scoring
              <select
                value={scoring}
                onChange={(e) => setScoring(e.target.value as Scoring)}
                className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="ppr">PPR</option>
                <option value="half-ppr">Half-PPR</option>
                <option value="standard">Standard</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={superflex}
                onChange={(e) => setSuperflex(e.target.checked)}
              />
              Superflex
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={dynasty}
                onChange={(e) => setDynasty(e.target.checked)}
              />
              Dynasty / Keeper
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Create Board
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {boards.length === 0 && !showForm && (
          <p className="text-sm text-zinc-500">
            No draft boards yet. Create one to get started.
          </p>
        )}
        {boards.map((b) => {
          const draftedCount = b.players.filter((p) => p.drafted).length;
          return (
            <div
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{b.name}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {PLATFORM_LABEL[b.platform]}
                  </span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {b.settings.teams} teams · {b.settings.scoring.toUpperCase()}
                  {b.settings.superflex ? " · Superflex" : ""}
                  {b.settings.dynasty ? " · Dynasty" : ""} ·{" "}
                  {b.players.length} players · {draftedCount} drafted · pick #
                  {b.currentPick}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <button
                  onClick={() => setActiveBoard(b.id)}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Open
                </button>
                <button
                  onClick={() => {
                    const newName = prompt("Name for the duplicate board?", `${b.name} copy`);
                    if (newName) duplicateBoard(b.id, newName);
                  }}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Clear all drafted markers on "${b.name}"? Tags and rankings are kept.`)) {
                      resetBoard(b.id);
                    }
                  }}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Reset
                </button>
                <button
                  onClick={() => {
                    const json = exportBoard(b.id);
                    if (json) downloadTextFile(`${b.name.replace(/\s+/g, "-")}.json`, json);
                  }}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Export
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${b.name}"? This can't be undone.`)) {
                      deleteBoard(b.id);
                    }
                  }}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
