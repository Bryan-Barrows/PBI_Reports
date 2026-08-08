# Whippany Fantasy Football League (WFFL) Website

A free, static website for the WFFL — current standings, league history, champions,
and all-time records. Pulls data automatically from Sleeper.

## How it works

- The site itself (`index.html`, `history.html`, `records.html`, `css/`, `js/`) is
  plain HTML/CSS/JS with no build step. It reads everything from `data/league-data.json`.
- `scripts/fetch-sleeper-data.mjs` is a Node script that calls Sleeper's public API,
  walks the league's history backward (via `previous_league_id`), and regenerates
  `data/league-data.json` with standings, champions, and all-time records.
- `.github/workflows/update-data.yml` runs that script automatically every day
  (and can be triggered manually) and commits the result — so the site stays current
  without you doing anything.

## One-time setup

### 1. Enable GitHub Pages (free hosting)

In this repo on GitHub: **Settings → Pages → Build and deployment → Source**,
choose **"Deploy from a branch"**, pick the `main` branch and `/ (root)` folder, then Save.
GitHub will give you a URL like `https://<your-username>.github.io/PBI_Reports/`.

### 2. Merge this branch to `main`

The scheduled Action only runs on the default branch (`main`), so once this work
is merged there, the daily auto-update will kick in.

### 3. Let the first data fetch run

Either wait for the daily schedule, or go to the **Actions** tab → **Update League
Data** → **Run workflow** to trigger it immediately. It will fetch your league's
history from Sleeper and commit `data/league-data.json`. Refresh the site after
it finishes (usually under a minute).

## Running the fetch manually (optional)

If you ever want to refresh data yourself instead of waiting on the Action:

```bash
node scripts/fetch-sleeper-data.mjs
```

(Requires Node 18+. It reads the league ID from the existing data file, or you
can pass one explicitly: `node scripts/fetch-sleeper-data.mjs <leagueId>`.)

## Pre-Sleeper history

The auto-fetch only finds seasons that exist in Sleeper's league chain. If your
league has history from before it was on Sleeper (paper standings, another
platform, etc.), add those seasons by hand to the `seasons` array in
`data/league-data.json`, using the same shape as the Sleeper-sourced entries,
and set `"source": "manual"` on them — the fetch script preserves manual entries
and won't overwrite them.

Example manual season entry:

```json
{
  "year": 2011,
  "leagueId": null,
  "status": "complete",
  "name": "WFFL 2011",
  "source": "manual",
  "standings": [
    { "rank": 1, "teamName": "...", "managerName": "...", "wins": 11, "losses": 3, "ties": 0, "pointsFor": 1520.4, "pointsAgainst": 1310.2, "ownerId": null }
  ],
  "champion": { "teamName": "...", "managerName": "..." },
  "runnerUp": { "teamName": "...", "managerName": "..." }
}
```

## Customizing

- League name: edit `leagueName` in `data/league-data.json` (persists across auto-fetches).
- Colors/branding: `css/style.css`.
- Update frequency: edit the `cron` line in `.github/workflows/update-data.yml`
  (currently once a day; you could set it hourly during the season).
