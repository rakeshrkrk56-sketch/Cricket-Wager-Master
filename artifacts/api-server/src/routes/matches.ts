import { Router, type IRouter } from "express";
import { db, matchesTable, marketsTable } from "@workspace/db";
import { eq, count, and } from "drizzle-orm";
import {
  ListMatchesQueryParams,
  ListMatchesResponse,
  GetMatchParams,
  GetMatchResponse,
  GetMatchMarketsParams,
  GetMatchMarketsQueryParams,
  GetMatchMarketsResponse,
  GetMarketParams,
  GetMarketResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/matches", async (req, res): Promise<void> => {
  const params = ListMatchesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let query = db.select().from(matchesTable);
  const conditions = [];
  if (params.data.status) conditions.push(eq(matchesTable.status, params.data.status as any));
  if (params.data.tournament) conditions.push(eq(matchesTable.tournament, params.data.tournament));

  const matches = await (conditions.length > 0
    ? db.select().from(matchesTable).where(and(...conditions))
    : db.select().from(matchesTable));

  res.json(
    ListMatchesResponse.parse({
      matches: matches.map(serializeMatch),
      total: matches.length,
    })
  );
});

router.get("/matches/:matchId", async (req, res): Promise<void> => {
  const params = GetMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, params.data.matchId));
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const [openMarketsResult] = await db
    .select({ total: count() })
    .from(marketsTable)
    .where(and(eq(marketsTable.matchId, match.id), eq(marketsTable.status, "open")));

  const [totalPredictionsResult] = await db
    .select({ total: count() })
    .from(marketsTable)
    .where(eq(marketsTable.matchId, match.id));

  res.json(
    GetMatchResponse.parse({
      ...serializeMatch(match),
      openMarketsCount: Number(openMarketsResult.total),
      totalPredictions: Number(totalPredictionsResult.total),
    })
  );
});

router.get("/matches/:matchId/markets", async (req, res): Promise<void> => {
  const pathParams = GetMatchMarketsParams.safeParse(req.params);
  const queryParams = GetMatchMarketsQueryParams.safeParse(req.query);
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }

  const conditions = [eq(marketsTable.matchId, pathParams.data.matchId)];
  if (queryParams.success && queryParams.data.status) {
    conditions.push(eq(marketsTable.status, queryParams.data.status as any));
  }
  if (queryParams.success && queryParams.data.category) {
    conditions.push(eq(marketsTable.category, queryParams.data.category as any));
  }

  const markets = await db.select().from(marketsTable).where(and(...conditions));

  res.json(
    GetMatchMarketsResponse.parse({
      markets: markets.map(serializeMarket),
      total: markets.length,
    })
  );
});

router.get("/markets/:marketId", async (req, res): Promise<void> => {
  const params = GetMarketParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [market] = await db.select().from(marketsTable).where(eq(marketsTable.id, params.data.marketId));
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  res.json(GetMarketResponse.parse(serializeMarket(market)));
});

function serializeMatch(m: any) {
  return {
    id: m.id,
    title: m.title ?? `${m.team1} vs ${m.team2}`,
    team1: m.team1,
    team2: m.team2,
    tournament: m.tournament,
    startTime: m.startTime instanceof Date ? m.startTime.toISOString() : m.startTime,
    status: m.status,
    cricApiMatchId: m.cricApiMatchId ?? undefined,
    liveScore: m.liveScore ?? undefined,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
  };
}

function serializeMarket(m: any) {
  return {
    id: m.id,
    matchId: m.matchId,
    question: m.question,
    questionHindi: m.questionHindi ?? undefined,
    category: m.category,
    yesPrice: Number(m.yesPrice),
    noPrice: Number(m.noPrice),
    status: m.status,
    correctAnswer: m.correctAnswer ?? undefined,
    totalYes: m.totalYes,
    totalNo: m.totalNo,
    totalAmount: Number(m.totalAmount),
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
    settledAt: m.settledAt ? (m.settledAt instanceof Date ? m.settledAt.toISOString() : m.settledAt) : undefined,
  };
}

export { serializeMatch, serializeMarket };
export default router;
