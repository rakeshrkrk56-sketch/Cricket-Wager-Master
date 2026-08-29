import { Router, type IRouter } from "express";
import { db, platformSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import QRCode from "qrcode";
import { getWhatsAppClientStatus } from "../lib/whatsappClient";

const router: IRouter = Router();

const DEFAULTS: Record<string, string> = {
  platform_upi_id: "",
  platform_upi_name: "Jazment Cricket",
  platform_upi_id_2: "",
  platform_upi_name_2: "",
  platform_upi_id_3: "",
  platform_upi_name_3: "",
  platform_name: "Jazment",
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
  const [upiId, upiName, upiId2, upiName2, upiId3, upiName3, name, bankName, bankHolder, bankAccount, bankIfsc] = await Promise.all([
    getSetting("platform_upi_id"),
    getSetting("platform_upi_name"),
    getSetting("platform_upi_id_2"),
    getSetting("platform_upi_name_2"),
    getSetting("platform_upi_id_3"),
    getSetting("platform_upi_name_3"),
    getSetting("platform_name"),
    getSetting("bank_name"),
    getSetting("bank_holder_name"),
    getSetting("bank_account_number"),
    getSetting("bank_ifsc"),
  ]);
  return {
    platformUpiId: upiId,
    platformUpiName: upiName,
    platformUpiId2: upiId2,
    platformUpiName2: upiName2,
    platformUpiId3: upiId3,
    platformUpiName3: upiName3,
    platformName: name,
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

router.get("/admin/whatsapp-otp/status", requireAdmin, async (_req, res): Promise<void> => {
  const state = getWhatsAppClientStatus();
  const qrDataUrl = state.qr
    ? await QRCode.toDataURL(state.qr, { width: 360, margin: 2, errorCorrectionLevel: "M" })
    : null;
  res.json({ status: state.status, qrDataUrl });
});

router.put("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const { platformUpiId, platformUpiName, platformUpiId2, platformUpiName2, platformUpiId3, platformUpiName3, platformName, bankName, bankHolderName, bankAccountNumber, bankIfsc } = req.body;

  const fieldMap: Record<string, string | undefined> = {
    platform_upi_id: platformUpiId,
    platform_upi_name: platformUpiName,
    platform_upi_id_2: platformUpiId2,
    platform_upi_name_2: platformUpiName2,
    platform_upi_id_3: platformUpiId3,
    platform_upi_name_3: platformUpiName3,
    platform_name: platformName,
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
