import { Router, type IRouter } from "express";
import { db, gameConfigsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import {
  DEFAULT_GAME_CONFIG_ID,
  ensureGameConfig,
  serializeGameConfig,
} from "../lib/gameConfig";

const router: IRouter = Router();

router.get("/admin/game-configs", requireAdmin, async (_req, res): Promise<void> => {
  await ensureGameConfig();
  const [config] = await db.select().from(gameConfigsTable)
    .where(eq(gameConfigsTable.id, DEFAULT_GAME_CONFIG_ID));
  if (!config) {
    res.status(500).json({ error: "Game configuration unavailable" });
    return;
  }
  res.json(serializeGameConfig(config));
});

router.post("/admin/update-game-configs", requireAdmin, async (req, res): Promise<void> => {
  const body = req.body as {
    payout_balance_mode?: unknown;
    onboarding_boost_active?: unknown;
  };

  const hasPayoutBalanceMode = body.payout_balance_mode !== undefined;
  const hasOnboardingBoostActive = body.onboarding_boost_active !== undefined;
  if (!hasPayoutBalanceMode && !hasOnboardingBoostActive) {
    res.status(400).json({
      error: "Provide payout_balance_mode or onboarding_boost_active as a boolean",
    });
    return;
  }
  if (
    (hasPayoutBalanceMode && typeof body.payout_balance_mode !== "boolean")
    || (hasOnboardingBoostActive && typeof body.onboarding_boost_active !== "boolean")
  ) {
    res.status(400).json({
      error: "payout_balance_mode and onboarding_boost_active must be booleans",
    });
    return;
  }

  await ensureGameConfig();
  const updates: Partial<typeof gameConfigsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (hasPayoutBalanceMode) updates.payoutBalanceMode = body.payout_balance_mode as boolean;
  if (hasOnboardingBoostActive) updates.onboardingBoostActive = body.onboarding_boost_active as boolean;

  const [config] = await db.update(gameConfigsTable)
    .set(updates)
    .where(eq(gameConfigsTable.id, DEFAULT_GAME_CONFIG_ID))
    .returning();
  if (!config) {
    res.status(500).json({ error: "Game configuration unavailable" });
    return;
  }

  res.json(serializeGameConfig(config));
});

export default router;