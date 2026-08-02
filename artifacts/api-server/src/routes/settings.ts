import { Router, type IRouter } from "express";
import { db, platformSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

const DEFAULTS: Record<string, string> = {
  platform_upi_id: "",
  platform_name: "Jazment",
  platform_upi_name: "Jazment Cricket",
  bank_name: "",
  bank_holder_name: "",
  bank_account_number: "",
  bank_ifsc: "",
};

async function getSetting(key: string): Promise<string> {
  const [row] = await db
    .select()
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.key, key));
  return row?.value ?? DEFAULTS[key] ?? "";
}

async function getAllSettings() {
  const [upiId, name, upiName, bankName, bankHolder, bankAccount, bankIfsc] = await Promise.all([
    getSetting("platform_upi_id"),
    getSetting("platform_name"),
    getSetting("platform_upi_name"),
    getSetting("bank_name"),
    getSetting("bank_holder_name"),
    getSetting("bank_account_number"),
    getSetting("bank_ifsc"),
  ]);
  return {
    platformUpiId: upiId,
    platformName: name,
    platformUpiName: upiName,
    bankName,
    bankHolderName: bankHolder,
    bankAccountNumber: bankAccount,
    bankIfsc,
  };
}

// ─── Public endpoint (used by mobile app) ────────────────────────────────────

router.get("/settings", async (_req, res): Promise<void> => {
  res.json(await getAllSettings());
});

// ─── Admin endpoints ──────────────────────────────────────────────────────────

router.get("/admin/settings", requireAdmin, async (_req, res): Promise<void> => {
  res.json(await getAllSettings());
});

router.put("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const { platformUpiId, platformName, platformUpiName, bankName, bankHolderName, bankAccountNumber, bankIfsc } = req.body;

  const fieldMap: Record<string, string | undefined> = {
    platform_upi_id: platformUpiId,
    platform_name: platformName,
    platform_upi_name: platformUpiName,
    bank_name: bankName,
    bank_holder_name: bankHolderName,
    bank_account_number: bankAccountNumber,
    bank_ifsc: bankIfsc,
  };

  const updates = Object.entries(fieldMap)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => ({ key, value: String(value).trim() }));

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

  res.json(await getAllSettings());
});

export default router;
