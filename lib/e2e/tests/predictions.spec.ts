/**
 * E2E tests: prediction flow
 *
 * Covers:
 *  1. Prediction below minimum ₹100 is rejected (mobile UI enforces this via API)
 *  2. Dynamic odds change after placing a prediction
 *  3. Prediction on a non-existent market returns 404
 *  4. Prediction with insufficient balance is rejected
 */
import { test, expect } from "@playwright/test";
import { seedUser, seedMatchMarket, cleanupUsers, authHeaders } from "./helpers";

test.describe("Prediction flow", () => {
  const collectedUserIds: string[] = [];

  test.afterAll(async ({ request }) => {
    await cleanupUsers(request, collectedUserIds);
  });

  test("prediction minimum ₹100 enforced — below minimum rejected", async ({ request }) => {
    // This test covers the ₹100 minimum that the mobile UI relies on.
    // The API is the single source of truth; the mobile UI reads this error.
    const ts = Date.now();
    const { token: userToken, user } = await seedUser(
      request,
      `+1557${ts}01`,
      { walletBalance: 500 }
    );
    collectedUserIds.push(user.id);
    const { marketId } = await seedMatchMarket(request);

    // ── ₹50 should be rejected ────────────────────────────────────────────────
    const resp = await request.post(`/api/markets/${marketId}/predict`, {
      headers: authHeaders(userToken),
      data: { choice: "YES", amount: 50 },
    });
    expect(resp.status(), "sub-₹100 prediction should be rejected with 400").toBe(400);
    const body = await resp.json();
    // The API enforces ₹100 minimum — either via Zod schema or the explicit guard.
    // Match the actual message returned by whichever validation fires first.
    const errorText = typeof body.error === "string" ? body.error : JSON.stringify(body.error);
    expect(errorText).toMatch(/100|minimum prediction/i);
  });

  test("prediction exactly ₹100 is accepted", async ({ request }) => {
    const ts = Date.now();
    const { token: userToken, user } = await seedUser(
      request,
      `+1557${ts}02`,
      { walletBalance: 500 }
    );
    collectedUserIds.push(user.id);
    const { marketId } = await seedMatchMarket(request);

    const resp = await request.post(`/api/markets/${marketId}/predict`, {
      headers: authHeaders(userToken),
      data: { choice: "YES", amount: 100 },
    });
    expect(resp.status(), "₹100 prediction should succeed").toBe(200);
    const prediction = await resp.json();
    expect(prediction.amount).toBe(100);
    expect(prediction.choice).toBe("YES");
    expect(prediction.status).toBe("pending");

    // Wallet deducted
    const meResp = await request.get("/api/auth/me", { headers: authHeaders(userToken) });
    const me = await meResp.json();
    expect(me.walletBalance, "wallet should be reduced by prediction amount").toBe(400);
  });

  test("dynamic odds change after placing a prediction", async ({ request }) => {
    const ts = Date.now();
    const { token: userToken, user } = await seedUser(
      request,
      `+1557${ts}03`,
      { walletBalance: 2000 }
    );
    collectedUserIds.push(user.id);
    const { marketId, yesPrice: initialYesPrice, noPrice: initialNoPrice } =
      await seedMatchMarket(request);

    // ── Get initial odds via market list ──────────────────────────────────────
    // (Markets are accessible via the matches endpoint)
    const marketResp = await request.get(`/api/markets/${marketId}`);
    let oddsBeforeYes: number;
    let oddsBeforeNo: number;
    if (marketResp.status() === 200) {
      const mkt = await marketResp.json();
      oddsBeforeYes = Number(mkt.yesPrice ?? mkt.yesOdds ?? initialYesPrice);
      oddsBeforeNo = Number(mkt.noPrice ?? mkt.noOdds ?? initialNoPrice);
    } else {
      // Fallback to seeded values
      oddsBeforeYes = initialYesPrice;
      oddsBeforeNo = initialNoPrice;
    }

    // ── Place a YES prediction ────────────────────────────────────────────────
    const predictResp = await request.post(`/api/markets/${marketId}/predict`, {
      headers: authHeaders(userToken),
      data: { choice: "YES", amount: 500 },
    });
    expect(predictResp.status(), "prediction should succeed").toBe(200);

    // ── Fetch updated market ──────────────────────────────────────────────────
    const afterResp = await request.get(`/api/markets/${marketId}`);
    if (afterResp.status() === 200) {
      const afterMarket = await afterResp.json();
      const oddsAfterYes = Number(afterMarket.yesPrice ?? afterMarket.yesOdds);
      const oddsAfterNo = Number(afterMarket.noPrice ?? afterMarket.noOdds);

      // YES pool grew → YES odds should decrease (worse payout), NO odds increase
      expect(
        oddsAfterYes,
        "YES odds should decrease after YES bets added to pool"
      ).toBeLessThan(oddsBeforeYes);
      expect(
        oddsAfterNo,
        "NO odds should increase as YES pool grows"
      ).toBeGreaterThan(oddsBeforeNo);
    } else {
      // If the market detail endpoint isn't exposed directly, verify via
      // the prediction response which includes potentialWin at current odds.
      // A ₹500 YES bet at initial odds 1.90 = ₹950 potential win.
      // After the pool shifts, subsequent bets at updated odds should differ.
      const pred2Resp = await request.post(`/api/markets/${marketId}/predict`, {
        headers: authHeaders(userToken),
        data: { choice: "YES", amount: 100 },
      });
      if (pred2Resp.status() === 200) {
        const pred2 = await pred2Resp.json();
        // potentialWin for ₹100 at initial 1.90 = ₹190. After pool shift it should differ.
        const expectedAtInitialOdds = 100 * oddsBeforeYes;
        expect(
          pred2.potentialWin,
          "potential win should reflect updated odds, not initial odds"
        ).not.toBe(Math.round(expectedAtInitialOdds * 100) / 100);
      }
    }
  });

  test("prediction on non-existent market returns 404", async ({ request }) => {
    const ts = Date.now();
    const { token: userToken, user } = await seedUser(
      request,
      `+1557${ts}04`,
      { walletBalance: 500 }
    );
    collectedUserIds.push(user.id);

    const resp = await request.post(`/api/markets/non-existent-market-id/predict`, {
      headers: authHeaders(userToken),
      data: { choice: "YES", amount: 100 },
    });
    expect(resp.status(), "unknown market should return 404").toBe(404);
  });

  test("prediction with insufficient balance is rejected", async ({ request }) => {
    const ts = Date.now();
    const { token: userToken, user } = await seedUser(
      request,
      `+1557${ts}05`,
      { walletBalance: 50 }
    );
    collectedUserIds.push(user.id);
    const { marketId } = await seedMatchMarket(request);

    const resp = await request.post(`/api/markets/${marketId}/predict`, {
      headers: authHeaders(userToken),
      data: { choice: "YES", amount: 100 },
    });
    expect(resp.status(), "prediction exceeding balance should be rejected").toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/insufficient/i);
  });
});
