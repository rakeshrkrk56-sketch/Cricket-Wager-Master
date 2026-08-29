import { Router, type IRouter } from "express";
import { requireAdmin } from "../middlewares/auth";
import { dragonTigerGame, type GameMode } from "../game/dragonTiger";
import { createAuditLog } from "../lib/createAuditLog";

const router: IRouter = Router();

router.get("/admin/game-control", requireAdmin, async (_req, res): Promise<void> => {
  res.json(await dragonTigerGame.getControlState());
});

router.put("/admin/game-control", requireAdmin, async (req, res): Promise<void> => {
  const { mode, paused, closeBetting } = req.body as {
    mode?: GameMode;
    paused?: boolean;
    closeBetting?: boolean;
  };
  if (mode !== undefined && mode !== "AUTOMATIC" && mode !== "MANAGED") {
    res.status(400).json({ error: "mode must be AUTOMATIC or MANAGED" });
    return;
  }
  if (paused !== undefined && typeof paused !== "boolean") {
    res.status(400).json({ error: "paused must be a boolean" });
    return;
  }
  if (closeBetting !== undefined && typeof closeBetting !== "boolean") {
    res.status(400).json({ error: "closeBetting must be a boolean" });
    return;
  }
  if (mode === undefined && paused === undefined && closeBetting !== true) {
    res.status(400).json({ error: "No game control changes provided" });
    return;
  }
  const admin = (req as any).user;
  const before = await dragonTigerGame.getControlState();
  const after = await dragonTigerGame.setControl({ mode, paused, closeBetting });
  await createAuditLog({
    adminId: admin.id,
    action: "dragon_tiger_control_updated",
    prevStatus: `${before.mode}:${before.paused ? "paused" : "running"}`,
    newStatus: `${after.mode}:${after.paused ? "paused" : "running"}`,
    metadata: {
      requested: { mode, paused, closeBetting: closeBetting === true },
      roundId: after.round?.id ?? null,
    },
  });
  res.json(after);
});

export default router;