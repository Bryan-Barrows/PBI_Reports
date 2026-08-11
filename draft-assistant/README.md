# Fantasy Football Draft Assistant

A local-first draft-day tool: merge rankings from multiple sites into one
sortable board, tag players Love/Like/Maybe/No, mark them drafted as picks
happen, and get a highlight when a player's ADP is close to the current
overall pick.

## Features

- **Multiple draft boards** — one per league (e.g. "Sleeper League",
  "Fleaflicker League"). Each board keeps its own drafted markers, current
  pick number, and imported rankings. Love/Like/Maybe/No tags are shared
  across boards, since that's your read on the player, not the league's.
- **Universal rankings import** — paste or upload a CSV/TSV table copied
  from any site (FantasyPros, Fantasy Points, Draft Sharks, a Sleeper ADP
  export, etc.). You label each import, map its columns once, and it merges
  into one player pool by name + position (with fuzzy-matching for minor
  spelling differences across sites).
- **Consensus rank + ADP** — every "rank"-type source you import gets
  averaged into a consensus rank; every "ADP"-type source gets averaged
  into an ADP column.
- **ADP-proximity highlighting** — rows tint pink when a player's ADP is
  within 5 of the current pick, amber within 10 — the players worth
  grabbing now vs. ones you can wait on.
- **Reset board** — clears drafted markers + the pick counter for a new
  draft, keeping your rankings and tags intact.
- **Export / Import board** — download a board as a JSON file to carry its
  state to another device (useful if you're drafting on a different
  computer/phone than the one you set rankings up on).

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

Data is stored in your browser's `localStorage` — nothing leaves your
machine unless you export a board file yourself.

## Tech stack

Next.js (App Router) + TypeScript + Tailwind CSS + Zustand (persisted
client state) + PapaParse (CSV parsing).

## Importing rankings

1. Open a board → **+ Add rankings source**.
2. Give it a label (e.g. "FantasyPros ECR") and pick its type:
   - **Ranking** — a positional/overall rank list, lower number = better.
   - **ADP** — average draft position values, used for the proximity
     highlight.
3. Paste the table (copy straight from the site) or upload a CSV/TSV file.
4. Confirm the column mapping (name is required; team, position, bye, and
   the rank/ADP column are auto-guessed from headers — double-check them).
5. Import. Any near-duplicate names get flagged so you can verify the merge.

Repeat for each site you use — the player table grows a column per source.
