// Client-side helpers for talking to Sleeper's public API through our
// own /api/sleeper proxy (see app/api/sleeper/[...path]/route.ts).

export interface SleeperPick {
  pick_no: number;
  draft_slot: number;
  metadata: {
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string;
  } | null;
}

export interface SleeperDraft {
  draft_id: string;
  draft_order: Record<string, number> | null; // user_id -> slot
  settings?: { teams?: number };
}

class SleeperApiError extends Error {}

async function sleeperFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api/sleeper/${path}`);
  if (!res.ok) {
    throw new SleeperApiError(`Sleeper API error (HTTP ${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function resolveSleeperUserId(username: string): Promise<string> {
  const user = await sleeperFetch<{ user_id: string } | null>(
    `user/${encodeURIComponent(username)}`
  );
  if (!user?.user_id) {
    throw new SleeperApiError(`No Sleeper user found for "${username}".`);
  }
  return user.user_id;
}

export async function getSleeperDraft(draftId: string): Promise<SleeperDraft> {
  return sleeperFetch<SleeperDraft>(`draft/${encodeURIComponent(draftId)}`);
}

export async function getSleeperPicks(draftId: string): Promise<SleeperPick[]> {
  const picks = await sleeperFetch<SleeperPick[] | null>(
    `draft/${encodeURIComponent(draftId)}/picks`
  );
  return picks ?? [];
}

// Accepts either a raw draft ID or a pasted sleeper.com draft room URL
// (e.g. https://sleeper.com/draft/nfl/1234567890123456789) and returns
// just the ID.
export function parseDraftIdInput(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/draft\/(?:nfl\/)?(\d+)/);
  return match ? match[1] : trimmed;
}

export function pickToNamePosition(pick: SleeperPick): {
  name: string;
  position: string;
} | null {
  const meta = pick.metadata;
  if (!meta?.first_name && !meta?.last_name) return null;
  const name = [meta.first_name, meta.last_name].filter(Boolean).join(" ");
  return { name, position: meta.position ?? "" };
}
