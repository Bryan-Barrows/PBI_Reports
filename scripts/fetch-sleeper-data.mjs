#!/usr/bin/env node
/**
 * fetch-sleeper-data.mjs
 *
 * Pulls league history, standings, and champions from the Sleeper public API
 * and writes the result to data/league-data.json for the static site to read.
 *
 * Sleeper's API is public and requires no auth key. Docs: https://docs.sleeper.com/
 *
 * Usage:
 *   node scripts/fetch-sleeper-data.mjs [currentLeagueId]
 *
 * If no league ID is passed, it reads currentLeagueId out of the existing
 * data/league-data.json so re-runs don't require re-typing it.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "data", "league-data.json");
const API_BASE = "https://api.sleeper.app/v1";

async function sleeperGet(pathSuffix) {
  const url = `${API_BASE}${pathSuffix}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Sleeper API error ${res.status} for ${url}`);
  }
  return res.json();
}

function teamNameFor(user) {
  return (
    user?.metadata?.team_name?.trim() ||
    user?.display_name ||
    `Manager ${user?.user_id ?? "Unknown"}`
  );
}

async function fetchSeason(leagueId) {
  const league = await sleeperGet(`/league/${leagueId}`);
  if (!league) return null;

  const [users, rosters, winnersBracket] = await Promise.all([
    sleeperGet(`/league/${leagueId}/users`),
    sleeperGet(`/league/${leagueId}/rosters`),
    sleeperGet(`/league/${leagueId}/winners_bracket`),
  ]);

  const usersById = new Map((users || []).map((u) => [u.user_id, u]));

  const standings = (rosters || [])
    .map((r) => {
      const user = usersById.get(r.owner_id);
      const s = r.settings || {};
      const fpts = (s.fpts || 0) + (s.fpts_decimal || 0) / 100;
      const fptsAgainst = (s.fpts_against || 0) + (s.fpts_against_decimal || 0) / 100;
      return {
        rosterId: r.roster_id,
        ownerId: r.owner_id,
        managerName: user?.display_name || "Unknown",
        teamName: teamNameFor(user),
        wins: s.wins || 0,
        losses: s.losses || 0,
        ties: s.ties || 0,
        pointsFor: Number(fpts.toFixed(2)),
        pointsAgainst: Number(fptsAgainst.toFixed(2)),
      };
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pointsFor - a.pointsFor;
    })
    .map((row, i) => ({ ...row, rank: i + 1 }));

  // Find champion / runner-up from the winners bracket's final placement match (p: 1).
  let champion = null;
  let runnerUp = null;
  if (Array.isArray(winnersBracket)) {
    const finalMatch = winnersBracket.find((m) => m.p === 1);
    if (finalMatch && finalMatch.w != null) {
      const winnerRoster = standings.find((r) => r.rosterId === finalMatch.w);
      const loserRoster = standings.find((r) => r.rosterId === finalMatch.l);
      champion = winnerRoster
        ? { teamName: winnerRoster.teamName, managerName: winnerRoster.managerName, ownerId: winnerRoster.ownerId }
        : null;
      runnerUp = loserRoster
        ? { teamName: loserRoster.teamName, managerName: loserRoster.managerName, ownerId: loserRoster.ownerId }
        : null;
    }
  }

  return {
    year: Number(league.season),
    leagueId,
    status: league.status, // 'pre_draft' | 'drafting' | 'in_season' | 'complete'
    name: league.name,
    source: "sleeper",
    standings,
    champion,
    runnerUp,
    previousLeagueId: league.previous_league_id || null,
  };
}

async function main() {
  const existingRaw = await readFile(DATA_PATH, "utf-8").catch(() => null);
  const existing = existingRaw ? JSON.parse(existingRaw) : {};

  const startLeagueId = process.argv[2] || existing.currentLeagueId;
  if (!startLeagueId) {
    console.error(
      "No league ID provided and none found in data/league-data.json (currentLeagueId). " +
        "Pass one: node scripts/fetch-sleeper-data.mjs <leagueId>"
    );
    process.exit(1);
  }

  console.log(`Starting from league ${startLeagueId}, walking history backward...`);

  const seasons = [];
  let cursor = startLeagueId;
  const seen = new Set();

  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    console.log(`Fetching season for league ${cursor}...`);
    let season;
    try {
      season = await fetchSeason(cursor);
    } catch (err) {
      console.error(`  Failed to fetch league ${cursor}: ${err.message}. Stopping walk here.`);
      break;
    }
    if (!season) {
      console.warn(`  League ${cursor} not found. Stopping walk here.`);
      break;
    }
    seasons.push(season);
    cursor = season.previousLeagueId;
  }

  seasons.sort((a, b) => b.year - a.year);

  // Preserve any manually-added historical seasons (e.g. pre-Sleeper years)
  // that aren't sourced from Sleeper, keyed by year.
  const manualSeasons = (existing.seasons || []).filter((s) => s.source === "manual");
  const sleeperYears = new Set(seasons.map((s) => s.year));
  const keptManual = manualSeasons.filter((s) => !sleeperYears.has(s.year));

  const allSeasons = [...seasons, ...keptManual].sort((a, b) => b.year - a.year);

  // Aggregate all-time standings & championship counts by ownerId.
  const byOwner = new Map();
  for (const season of allSeasons) {
    for (const row of season.standings || []) {
      if (!row.ownerId) continue;
      const agg =
        byOwner.get(row.ownerId) ||
        {
          ownerId: row.ownerId,
          managerName: row.managerName,
          teamName: row.teamName,
          seasonsPlayed: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          championships: 0,
        };
      agg.seasonsPlayed += 1;
      agg.wins += row.wins;
      agg.losses += row.losses;
      agg.ties += row.ties;
      agg.pointsFor += row.pointsFor;
      agg.pointsAgainst += row.pointsAgainst;
      // Keep the most recent team name as the display name.
      agg.teamName = row.teamName;
      agg.managerName = row.managerName;
      byOwner.set(row.ownerId, agg);
    }
    if (season.champion?.ownerId) {
      const agg = byOwner.get(season.champion.ownerId);
      if (agg) agg.championships += 1;
    }
  }

  const allTimeStandings = Array.from(byOwner.values())
    .map((a) => ({ ...a, pointsFor: Number(a.pointsFor.toFixed(2)), pointsAgainst: Number(a.pointsAgainst.toFixed(2)) }))
    .sort((a, b) => b.wins - a.wins || b.championships - a.championships);

  const championships = allTimeStandings
    .filter((a) => a.championships > 0)
    .map((a) => ({ managerName: a.managerName, teamName: a.teamName, count: a.championships }))
    .sort((a, b) => b.count - a.count);

  const output = {
    leagueName: existing.leagueName || "Fantasy Football League",
    platform: "sleeper",
    currentLeagueId: startLeagueId,
    lastUpdated: new Date().toISOString(),
    seasons: allSeasons,
    allTime: {
      standings: allTimeStandings,
      championships,
    },
    notes: existing.notes || [],
  };

  await writeFile(DATA_PATH, JSON.stringify(output, null, 2) + "\n", "utf-8");
  console.log(`Wrote ${allSeasons.length} season(s) to ${DATA_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
