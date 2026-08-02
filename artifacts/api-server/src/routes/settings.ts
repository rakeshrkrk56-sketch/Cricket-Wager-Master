import { Router, type IRouter } from "express";
import { db, platformSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

const DEFAULTS: Record<string, string> = {
  platform_upi_id: "",
  platform_name: "Jazment",
  platform_upi_name: "Jazment Cricket",
};

async function getSetting(key: string): Promise<string> {
  const [row] = await db
    .select()
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.key, key));
  return row?.value ?? DEFAULTS[key] ?? "";
}

// ─── Public endpoint (used by mobile app) ────────────────────────────────────

router.get("/settings", async (_req, res): Promise<void> => {
  const [upiId, name, upiName] = await Promise.all([
    getSetting("platform_upi_id"),
    getSetting("platform_name"),
    getSetting("platform_upi_name"),
  ]);
  res.json({ platformUpiId: upiId, platformName: name, platformUpiName: upiName });
});

// ─── Admin endpoints ──────────────────────────────────────────────────────────

router.get("/admin/settings", requireAdmin, async (_req, res): Promise<void> => {
  const [upiId, name, upiName] = await Promise.all([
    getSetting("platform_upi_id"),
    getSetting("platform_name"),
    getSetting("platform_upi_name"),
  ]);
  res.json({ platformUpiId: upiId, platformName: name, platformUpiName: upiName });
});

router.put("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const { platformUpiId, platformName, platformUpiName } = req.body;

  const updates: { key: string; value: string }[] = [];
  if (platformUpiId !== undefined) updates.push({ key: "platform_upi_id", value: String(platformUpiId).trim() });
  if (platformName !== undefined) updates.push({ key: "platform_name", value: String(platformName).trim() });
  if (platformUpiName !== undefined) updates.push({ key: "platform_upi_name", value: String(platformUpiName).trim() });

  if (updates.length === 0) {
    res.status(400).json({ error: "No settings provided" });
    return;
  }

  await Promise.all(
    updates.map((u) =>
      db
        .insert(platformSettingsTable)
        .values({ key: u.key, value: u.value, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: platformSettingsTable.key,
          set: { value: u.value, updatedAt: new Date() },
        })
    )
  );

  const [upiId, name, upiName] = await Promise.all([
    getSetting("platform_upi_id"),
    getSetting("platform_name"),
    getSetting("platform_upi_name"),
  ]);
  res.json({ platformUpiId: upiId, platformName: name, platformUpiName: upiName });
});

export default router;
