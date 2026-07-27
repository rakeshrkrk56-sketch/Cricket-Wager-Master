/**
 * Shared helpers for Jazment e2e API tests.
 *
 * All helpers talk to the API via Playwright's APIRequestContext so they
 * respect the baseURL set in playwright.config.ts.
 */
import { APIRequestContext, expect } from "@playwright/test";

export interface SeedUserResult {
  token: string;
  user: { id: string; phone: string; role: string; walletBalance: number };
}

/**
 * Secret header value for test-seed endpoints.
 * Must match E2E_TEST_SECRET on the API server.
 */
const E2E_SECRET = process.env["E2E_TEST_SECRET"] ?? "dev-e2e-secret";

/** Extra headers required by the test-seed surface. */
export function seedHeaders() {
  return { "x-e2e-secret": E2E_SECRET };
}

/** Create (or reset) a test user via the dev-only seeding endpoint. */
export async function seedUser(
  request: APIRequestContext,
  phone: string,
  opts: { role?: "user" | "admin"; walletBalance?: number } = {}
): Promise<SeedUserResult> {
  const resp = await request.post("/api/test/seed-user", {
    headers: seedHeaders(),
    data: {
      phone,
      role: opts.role ?? "user",
      walletBalance: String(opts.walletBalance ?? 0),
    },
  });
  expect(resp.status(), `seed-user failed for ${phone}`).toBe(200);
  return resp.json();
}

/** Create a live match + open market for prediction tests. */
export async function seedMatchMarket(
  request: APIRequestContext
): Promise<{ matchId: string; marketId: string; yesPrice: number; noPrice: number }> {
  const resp = await request.post("/api/test/seed-match-market", {
    headers: seedHeaders(),
    data: {},
  });
  expect(resp.status(), "seed-match-market failed").toBe(200);
  return resp.json();
}

/** Delete seeded users after a test to keep the DB clean. */
export async function cleanupUsers(
  request: APIRequestContext,
  userIds: string[]
): Promise<void> {
  if (!userIds.length) return;
  await request.post("/api/test/cleanup", {
    headers: seedHeaders(),
    data: { userIds },
  });
}

/** Make an authenticated API request. */
export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}
