/**
 * E2E tests: withdrawal flow
 *
 * Covers:
 *  1. User submits a withdrawal → admin approves → wallet is debited
 *  2. Withdrawal below minimum ₹500 is rejected
 *  3. Withdrawal exceeding available balance is rejected
 *  4. Admin reject does NOT deduct from wallet
 *  5. Concurrent admin approvals debit the wallet exactly once
 */
import { test, expect } from "@playwright/test";
import { seedUser, cleanupUsers, authHeaders } from "./helpers";

test.describe("Withdrawal flow", () => {
  const collectedUserIds: string[] = [];

  test.afterAll(async ({ request }) => {
    await cleanupUsers(request, collectedUserIds);
  });

  test("withdrawal → admin approve → wallet debited", async ({ request }) => {
    // ── Arrange ──────────────────────────────────────────────────────────────
    const ts = Date.now();
    const initialBalance = 2000;
    const withdrawAmount = 1000;

    const { token: userToken, user } = await seedUser(
      request,
      `+1556${ts}01`,
      { walletBalance: initialBalance }
    );
    const { token: adminToken, user: adminUser } = await seedUser(
      request,
      `+1556${ts}99`,
      { role: "admin" }
    );
    collectedUserIds.push(user.id, adminUser.id);

    // ── Act: submit withdrawal ────────────────────────────────────────────────
    const submitResp = await request.post("/api/withdrawals", {
      headers: authHeaders(userToken),
      data: { amount: withdrawAmount, upiId: "test@upi" },
    });
    expect(submitResp.status(), "withdrawal submission should succeed").toBe(201);
    const withdrawal = await submitResp.json();
    expect(withdrawal.status).toBe("pending");
    expect(withdrawal.amount).toBe(withdrawAmount);

    // ── Act: admin approves ───────────────────────────────────────────────────
    const approveResp = await request.post(
      `/api/admin/withdrawals/${withdrawal.id}/approve`,
      {
        headers: authHeaders(adminToken),
        data: { remarks: "Test approval" },
      }
    );
    expect(approveResp.status(), "admin approve should succeed").toBe(200);
    const approveBody = await approveResp.json();
    expect(approveBody.success).toBe(true);
    expect(approveBody.balanceAfter).toBe(initialBalance - withdrawAmount);

    // ── Assert: wallet balance debited ────────────────────────────────────────
    const meResp = await request.get("/api/auth/me", {
      headers: authHeaders(userToken),
    });
    expect(meResp.status()).toBe(200);
    const me = await meResp.json();
    expect(
      me.walletBalance,
      "wallet should be debited by the withdrawal amount"
    ).toBe(initialBalance - withdrawAmount);
  });

  test("withdrawal below minimum ₹500 is rejected", async ({ request }) => {
    const ts = Date.now();
    const { token: userToken, user } = await seedUser(
      request,
      `+1556${ts}02`,
      { walletBalance: 1000 }
    );
    collectedUserIds.push(user.id);

    const resp = await request.post("/api/withdrawals", {
      headers: authHeaders(userToken),
      data: { amount: 200, upiId: "test@upi" },
    });
    expect(resp.status(), "sub-minimum withdrawal should be rejected").toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/minimum withdrawal/i);
  });

  test("withdrawal exceeding available balance is rejected", async ({ request }) => {
    const ts = Date.now();
    const { token: userToken, user } = await seedUser(
      request,
      `+1556${ts}03`,
      { walletBalance: 300 }
    );
    collectedUserIds.push(user.id);

    const resp = await request.post("/api/withdrawals", {
      headers: authHeaders(userToken),
      data: { amount: 1000, upiId: "test@upi" },
    });
    expect(resp.status(), "over-balance withdrawal should be rejected").toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/insufficient/i);
  });

  test("concurrent admin approvals debit the wallet exactly once", async ({ request }) => {
    // Simulates two admins clicking Approve simultaneously under load.
    // Only one request should win; the second must get "already processed".
    const ts = Date.now();
    const initialBalance = 2000;
    const withdrawAmount = 500;

    const { token: userToken, user } = await seedUser(
      request,
      `+1556${ts}05`,
      { walletBalance: initialBalance }
    );
    const { token: adminToken1, user: adminUser1 } = await seedUser(
      request,
      `+1556${ts}91`,
      { role: "admin" }
    );
    const { token: adminToken2, user: adminUser2 } = await seedUser(
      request,
      `+1556${ts}92`,
      { role: "admin" }
    );
    collectedUserIds.push(user.id, adminUser1.id, adminUser2.id);

    const submitResp = await request.post("/api/withdrawals", {
      headers: authHeaders(userToken),
      data: { amount: withdrawAmount, upiId: "test@upi" },
    });
    expect(submitResp.status()).toBe(201);
    const withdrawal = await submitResp.json();

    // Fire both approvals concurrently
    const [res1, res2] = await Promise.all([
      request.post(`/api/admin/withdrawals/${withdrawal.id}/approve`, {
        headers: authHeaders(adminToken1),
        data: {},
      }),
      request.post(`/api/admin/withdrawals/${withdrawal.id}/approve`, {
        headers: authHeaders(adminToken2),
        data: {},
      }),
    ]);

    const statuses = [res1.status(), res2.status()].sort();
    expect(statuses, "exactly one approval should succeed").toEqual([200, 400]);

    const bodies = await Promise.all([res1.json(), res2.json()]);
    const failBody = bodies.find((b) => b.error);
    expect(failBody?.error).toMatch(/already processed/i);

    // Wallet must be debited exactly once
    const meResp = await request.get("/api/auth/me", { headers: authHeaders(userToken) });
    const me = await meResp.json();
    expect(
      me.walletBalance,
      "wallet must be debited exactly once"
    ).toBe(initialBalance - withdrawAmount);
  });

  test("admin reject does NOT deduct from wallet", async ({ request }) => {
    const ts = Date.now();
    const initialBalance = 1500;

    const { token: userToken, user } = await seedUser(
      request,
      `+1556${ts}04`,
      { walletBalance: initialBalance }
    );
    const { token: adminToken, user: adminUser } = await seedUser(
      request,
      `+1556${ts}98`,
      { role: "admin" }
    );
    collectedUserIds.push(user.id, adminUser.id);

    const submitResp = await request.post("/api/withdrawals", {
      headers: authHeaders(userToken),
      data: { amount: 500, upiId: "test@upi" },
    });
    expect(submitResp.status()).toBe(201);
    const withdrawal = await submitResp.json();

    const rejectResp = await request.post(
      `/api/admin/withdrawals/${withdrawal.id}/reject`,
      {
        headers: authHeaders(adminToken),
        data: { remarks: "Cannot process" },
      }
    );
    expect(rejectResp.status(), "reject should succeed").toBe(200);

    // Wallet must NOT be debited
    const meResp = await request.get("/api/auth/me", {
      headers: authHeaders(userToken),
    });
    const me = await meResp.json();
    expect(
      me.walletBalance,
      "wallet must not be debited after withdrawal rejection"
    ).toBe(initialBalance);
  });
});
