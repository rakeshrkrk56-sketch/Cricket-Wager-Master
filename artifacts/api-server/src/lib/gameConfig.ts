import { db, gameConfigsTable } from "@workspace/db";

export const DEFAULT_GAME_CONFIG_ID = "default";

export async function ensureGameConfig(): Promise<void> {
  await db.insert(gameConfigsTable).values({
    id: DEFAULT_GAME_CONFIG_ID,
    payoutBalanceMode: false,
    onboardingBoostActive: false,
    targetFeeRate: 5,
  }).onConflictDoNothing();
}

export function serializeGameConfig(config: typeof gameConfigsTable.$inferSelect) {
  return {
    payout_balance_mode: config.payoutBalanceMode,
    onboarding_boost_active: config.onboardingBoostActive,
    target_fee_rate: config.targetFeeRate,
    updated_at: config.updatedAt.toISOString(),
  };
}