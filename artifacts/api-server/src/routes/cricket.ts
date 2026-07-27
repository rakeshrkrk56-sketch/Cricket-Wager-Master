import { Router, type IRouter } from "express";
import { GetCricketScoreParams, GetLiveCricketMatchesResponse, GetCricketScoreResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const CRICAPI_KEY = process.env.CRICAPI_KEY;
const CRICAPI_BASE = "https://api.cricapi.com/v1";

async function fetchCricApi(endpoint: string, params: Record<string, string> = {}) {
  if (!CRICAPI_KEY) {
    return null;
  }
  const url = new URL(`${CRICAPI_BASE}/${endpoint}`);
  url.searchParams.set("apikey", CRICAPI_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  try {
    const res = await fetch(url.toString());
    const data = await res.json() as any;
    return data;
  } catch (err) {
    logger.error({ err }, "CricAPI fetch error");
    return null;
  }
}

// Mock data for when CRICAPI_KEY is not configured
function getMockMatches() {
  return [
    { id: "mock-1", name: "India vs Australia, 1st Test", status: "live", venue: "Wankhede Stadium, Mumbai", date: new Date().toISOString(), teams: ["India", "Australia"] },
    { id: "mock-2", name: "England vs Pakistan, 2nd ODI", status: "match not started", venue: "Lord's Cricket Ground", date: new Date(Date.now() + 86400000).toISOString(), teams: ["England", "Pakistan"] },
    { id: "mock-3", name: "IPL 2025 - CSK vs MI", status: "live", venue: "M. A. Chidambaram Stadium", date: new Date().toISOString(), teams: ["Chennai Super Kings", "Mumbai Indians"] },
    { id: "mock-4", name: "IPL 2025 - RCB vs KKR", status: "match not started", venue: "M. Chinnaswamy Stadium", date: new Date(Date.now() + 172800000).toISOString(), teams: ["Royal Challengers Bangalore", "Kolkata Knight Riders"] },
  ];
}

router.get("/cricket/live", async (req, res): Promise<void> => {
  const data = await fetchCricApi("currentMatches", { offset: "0" });

  if (!data || data.status !== "success") {
    const mockMatches = getMockMatches();
    res.json(
      GetLiveCricketMatchesResponse.parse({
        matches: mockMatches,
        total: mockMatches.length,
      })
    );
    return;
  }

  const matches = (data.data || []).map((m: any) => ({
    id: m.id,
    name: m.name,
    status: m.status,
    venue: m.venue ?? undefined,
    date: m.date ?? undefined,
    teams: m.teams ?? [],
  }));

  res.json(
    GetLiveCricketMatchesResponse.parse({
      matches,
      total: matches.length,
    })
  );
});

router.get("/cricket/score/:cricMatchId", async (req, res): Promise<void> => {
  const params = GetCricketScoreParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const data = await fetchCricApi("match_score", { id: params.data.cricMatchId });

  if (!data || data.status !== "success") {
    res.json(
      GetCricketScoreResponse.parse({
        matchId: params.data.cricMatchId,
        name: "Score unavailable",
        status: "N/A",
        score: [],
        teams: [],
      })
    );
    return;
  }

  const m = data.data;
  res.json(
    GetCricketScoreResponse.parse({
      matchId: m.id,
      name: m.name,
      status: m.status,
      score: m.score ?? [],
      teams: m.teams ?? [],
    })
  );
});

export default router;
