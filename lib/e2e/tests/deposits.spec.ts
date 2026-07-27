/**
 * E2E tests: deposit flow
 *
 * Covers:
 *  1. User submits a manual deposit → admin approves → wallet is credited
 *  2. Duplicate UTR submission is blocked (409)
 *  3. Concurrent admin approvals cannot double-credit the wallet
 */
import { test, expect } from "@playwright/test";
import { seedUser, cleanupUsers, authHeaders } from "./helpers";

test.describe("Deposit flow", () => {
  const collectedUserIds: string[] = [];

  test.afterAll(async ({ request }) => {
    await cleanupUsers(request, collectedUserIds);
  });

  test("deposit → admin approve → wallet credited", async ({ request }) => {
    // ── Arrange ──────────────────────────────────────────────────────────────
    const ts = Date.now();
    const { token: userToken, user } = await seedUser(
      request,
      `+1555${ts}01`,
      { walletBalance: 0 }
    );
    const { token: adminToken, user: adminUser } = await seedUser(
      request,
      `+1555${ts}99`,
      { role: "admin" }
    );
    collectedUserIds.push(user.id, adminUser.id);

    const depositAmount = 500;
    const utrNumber = `UTR${ts}01`;

    // ── Act: submit deposit ───────────────────────────────────────────────────
    const submitResp = await request.post("/api/deposits", {
      headers: authHeaders(userToken),
      data: { amount: depositAmount, method: "manual", utrNumber },
    });
    expect(submitResp.status(), "deposit submission should succeed").toBe(201);
    const deposit = await submitResp.json();
    expect(deposit.status).toBe("pending");
    expect(deposit.amount).toBe(depositAmount);

    // ── Act: admin approves ───────────────────────────────────────────────────
    const approveResp = await request.post(
      `/api/admin/deposits/${deposit.id}/approve`,
      {
        headers: authHeaders(adminToken),
        data: { remarks: "Test approval" },
      }
    );
    expect(approveResp.status(), "admin approve should succeed").toBe(200);
    const approveBody = await approveResp.json();
    expect(approveBody.success).toBe(true);
    expect(approveBody.balanceAfter).toBe(depositAmount);

    // ── Assert: wallet balance credited ───────────────────────────────────────
    const meResp = await request.get("/api/auth/me", {
      headers: authHeaders(userToken),
    });
    expect(meResp.status()).toBe(200);
    const me = await meResp.json();
    expect(me.walletBalance, "wallet should be credited with deposit amount").toBe(
      depositAmount
    );
  });

  test("duplicate UTR submission is blocked", async ({ request }) => {
    // ── Arrange ──────────────────────────────────────────────────────────────
    const ts = Date.now();
    const { token: userToken, user } = await seedUser(
      request,
      `+1555${ts}02`
    );
    collectedUserIds.push(user.id);

    const utrNumber = `UTR${ts}DUP`;

    // ── First submission ──────────────────────────────────────────────────────
    const first = await request.post("/api/deposits", {
      headers: authHeaders(userToken),
      data: { amount: 200, method: "manual", utrNumber },
    });
    expect(first.status(), "first submission should succeed").toBe(201);

    // ── Duplicate submission ──────────────────────────────────────────────────
    const second = await request.post("/api/deposits", {
      headers: authHeaders(userToken),
      data: { amount: 200, method: "manual", utrNumber },
    });
    expect(second.status(), "duplicate UTR should be rejected with 409").toBe(409);
    const body = await second.json();
    expect(body.error).toMatch(/already been submitted/i);
  });

  test("deposit below minimum ₹200 is rejected", async ({ request }) => {
    const ts = Date.now();
    const { token: userToken, user } = await seedUser(
      request,
      `+1555${ts}03`
    );
    collectedUserIds.push(user.id);

    const resp = await request.post("/api/deposits", {
      headers: authHeaders(userToken),
      data: { amount: 100, method: "manual", utrNumber: `UTR${ts}MIN` },
    });
    expect(resp.status(), "sub-minimum deposit should be rejected").toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/minimum deposit/i);
  });

  test("concurrent admin approvals credit the wallet exactly once", async ({ request }) => {
    // Simulates two admins clicking Approve simultaneously under load.
    // Only one request should win; the second must get "already processed".
    const ts = Date.now();
    const depositAmount = 500;

    const { token: userToken, user } = await seedUser(
      request,
      `+1555${ts}05`,
      { walletBalance: 0 }
    );
    const { token: adminToken1, user: adminUser1 } = await seedUser(
      request,
      `+1555${ts}91`,
      { role: "admin" }
    );
    const { token: adminToken2, user: adminUser2 } = await seedUser(
      request,
      `+1555${ts}92`,
      { role: "admin" }
    );
    collectedUserIds.push(user.id, adminUser1.id, adminUser2.id);

    const submitResp = await request.post("/api/deposits", {
      headers: authHeaders(userToken),
      data: { amount: depositAmount, method: "manual", utrNumber: `UTR${ts}CONC` },
    });
    expect(submitResp.status()).toBe(201);
    const deposit = await submitResp.json();

    // Fire both approvals concurrently
    const [res1, res2] = await Promise.all([
      request.post(`/api/admin/deposits/${deposit.id}/approve`, {
        headers: authHeaders(adminToken1),
        data: {},
      }),
      request.post(`/api/admin/deposits/${deposit.id}/approve`, {
        headers: authHeaders(adminToken2),
        data: {},
      }),
    ]);

    const statuses = [res1.status(), res2.status()].sort();
    // Exactly one must succeed (200) and one must fail (400 = already processed)
    expect(statuses, "exactly one approval should succeed").toEqual([200, 400]);

    const bodies = await Promise.all([res1.json(), res2.json()]);
    const successBody = bodies.find((b) => b.success);
    const failBody = bodies.find((b) => b.error);
    expect(successBody).toBeDefined();
    expect(failBody?.error).toMatch(/already processed/i);

    // Wallet must be credited exactly once
    const meResp = await request.get("/api/auth/me", { headers: authHeaders(userToken) });
    const me = await meResp.json();
    expect(me.walletBalance, "wallet must be credited exactly once").toBe(depositAmount);
  });

  test("admin reject updates deposit status without crediting wallet", async ({ request }) => {
    const ts = Date.now();
    const { token: userToken, user } = await seedUser(
      request,
      `+1555${ts}04`
    );
    const { token: adminToken, user: adminUser } = await seedUser(
      request,
      `+1555${ts}98`,
      { role: "admin" }
    );
    collectedUserIds.push(user.id, adminUser.id);

    const submitResp = await request.post("/api/deposits", {
      headers: authHeaders(userToken),
      data: { amount: 300, method: "manual", utrNumber: `UTR${ts}REJ` },
    });
    expect(submitResp.status()).toBe(201);
    const deposit = await submitResp.json();

    const rejectResp = await request.post(
      `/api/admin/deposits/${deposit.id}/reject`,
      {
        headers: authHeaders(adminToken),
        data: { remarks: "Invalid screenshot" },
      }
    );
    expect(rejectResp.status(), "reject should succeed").toBe(200);

    // Wallet must NOT be credited
    const meResp = await request.get("/api/auth/me", {
      headers: authHeaders(userToken),
    });
    const me = await meResp.json();
    expect(me.walletBalance, "wallet must not be credited after rejection").toBe(0);
  });
});
