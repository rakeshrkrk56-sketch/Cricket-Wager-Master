import { Router, type IRouter } from "express";
import { GetCricketScoreParams, GetLiveCricketMatchesResponse, GetCricketScoreResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const CRICAPI_KEY = process.env.CRICAPI_KEY;
const CRICAPI_BASE = "https://api.cricapi.com/v1";
const PROVIDER_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 15_000;
// The match list changes rarely (fixtures/status), and this endpoint costs
// two provider hits — cache it longer to stay inside the daily quota.
const LIVE_LIST_CACHE_TTL_MS = 120_000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

let liveMatchesCache: CacheEntry<unknown> | undefined;
const scoreCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(entry: CacheEntry<T> | undefined): T | undefined {
  return entry && entry.expiresAt > Date.now() ? entry.value : undefined;
}

function providerUnavailable(res: any, message: string): void {
  res.status(503).json({
    error: message,
    source: "cricket-data-provider",
  });
}

async function fetchCricApi(endpoint: string, params: Record<string, string> = {}) {
  if (!CRICAPI_KEY) {
    throw new Error("CRICAPI_KEY is not configured");
  }

  const url = new URL(`${CRICAPI_BASE}/${endpoint}`);
  url.searchParams.set("apikey", CRICAPI_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`CricAPI responded with HTTP ${res.status}`);
    }
    const data = await res.json() as { status?: string; data?: unknown; info?: string };
    if (data.status !== "success") {
      throw new Error(data.info || "CricAPI returned an unsuccessful response");
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function toCricketMatch(m: any) {
  return {
    id: m.id,
    name: m.name,
    status: m.status,
    venue: m.venue ?? undefined,
    date: m.date ?? undefined,
    teams: m.teams ?? [],
    dateTimeGMT: m.dateTimeGMT ?? undefined,
    matchType: m.matchType ?? undefined,
    matchStarted: m.matchStarted ?? undefined,
    matchEnded: m.matchEnded ?? undefined,
  };
}

router.get("/cricket/live", async (req, res): Promise<void> => {
  // Return cached response if still fresh
  const cached = getCached(liveMatchesCache);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    // currentMatches = live/recent; matches = series list incl. upcoming fixtures.
    const [current, upcoming] = await Promise.all([
      fetchCricApi("currentMatches", { offset: "0" }) as Promise<{ data?: any[] }>,
      fetchCricApi("matches", { offset: "0" }) as Promise<{ data?: any[] }>,
    ]);

    const byId = new Map<string, any>();
    for (const m of current.data || []) byId.set(m.id, toCricketMatch(m));
    for (const m of upcoming.data || []) {
      if (!byId.has(m.id) && m.matchEnded !== true) byId.set(m.id, toCricketMatch(m));
    }

    // Live/in-progress first, then upcoming by start time
    const matches = Array.from(byId.values()).sort((a, b) => {
      const aLive = a.matchStarted === true && a.matchEnded !== true ? 0 : 1;
      const bLive = b.matchStarted === true && b.matchEnded !== true ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      return String(a.dateTimeGMT ?? "").localeCompare(String(b.dateTimeGMT ?? ""));
    });

    const response = GetLiveCricketMatchesResponse.parse({
      matches,
      total: matches.length,
    });

    liveMatchesCache = { value: response, expiresAt: Date.now() + LIVE_LIST_CACHE_TTL_MS };
    res.json(response);
  } catch (err) {
    logger.warn({ err }, "CricAPI live matches unavailable");
    providerUnavailable(res, "Live cricket data is temporarily unavailable");
  }
});

router.get("/cricket/score/:cricMatchId", async (req, res): Promise<void> => {
  const params = GetCricketScoreParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const matchId = params.data.cricMatchId;

  // Return cached response if still fresh
  const cached = getCached(scoreCache.get(matchId));
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    // match_info is available on the free/low-cost CricAPI tiers (match_score is not)
    // and returns the same score array plus toss/venue info.
    const data = await fetchCricApi("match_info", { id: matchId }) as { data?: any };
    const m = data.data;
    const response = GetCricketScoreResponse.parse({
      matchId: m.id,
      name: m.name,
      status: m.status,
      score: m.score ?? [],
      teams: m.teams ?? [],
    });

    scoreCache.set(matchId, { value: response, expiresAt: Date.now() + CACHE_TTL_MS });
    res.json(response);
  } catch (err) {
    logger.warn({ err, matchId }, "CricAPI score unavailable");
    providerUnavailable(res, "This cricket score is temporarily unavailable");
  }
});

export default router;
