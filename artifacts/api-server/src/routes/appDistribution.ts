import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Router, type IRouter, type Response } from "express";
import { db, platformSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { createApkUpload, getPrivateFile, pipeFile } from "../lib/objectStorage";

const router: IRouter = Router();
const MAX_APK_BYTES = 300 * 1024 * 1024;
const DEFAULT_APK_FILE_NAME = "Jazment.apk";

async function readValue(key: string) {
  const [row] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, key));
  return row?.value ?? "";
}

/**
 * VPS fallback: when APK_FILE_PATH points to an existing regular file, serve it
 * directly from disk (no Object Storage sidecar needed). Returns false when the
 * variable is unset or the file is missing so the caller keeps the existing
 * Object Storage behavior.
 */
async function serveLocalApk(res: Response, fileName: string): Promise<boolean> {
  const localPath = process.env.APK_FILE_PATH?.trim();
  if (!localPath) return false;
  let size: number;
  try {
    const info = await stat(localPath);
    if (!info.isFile()) return false;
    size = info.size;
  } catch {
    return false;
  }
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(/[^\w.-]/g, "_")}"`);
  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("Content-Length", String(size));
  await new Promise<void>((resolve, reject) => {
    createReadStream(localPath).on("error", reject).on("end", resolve).pipe(res);
  });
  return true;
}

async function writeValue(key: string, value: string) {
  await db.insert(platformSettingsTable)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value, updatedAt: new Date() } });
}

router.get("/app/apk-info", async (_req, res): Promise<void> => {
  const [objectPath, fileName, size, updatedAt] = await Promise.all([
    readValue("apk_object_path"),
    readValue("apk_file_name"),
    readValue("apk_file_size"),
    readValue("apk_updated_at"),
  ]);
  res.json({
    available: Boolean(objectPath),
    fileName: fileName || "Jazment.apk",
    size: Number(size) || 0,
    updatedAt: updatedAt || null,
    downloadUrl: objectPath ? "/api/app/apk" : null,
  });
});

router.get("/app/apk", async (req, res): Promise<void> => {
  try {
    let objectPath = "";
    let fileName = "";
    let settingsError: unknown = null;
    try {
      [objectPath, fileName] = await Promise.all([
        readValue("apk_object_path"),
        readValue("apk_file_name"),
      ]);
    } catch (error) {
      // Local-file fallback must still work when the settings table is unreachable.
      settingsError = error;
    }
    if (await serveLocalApk(res, fileName || DEFAULT_APK_FILE_NAME)) return;
    if (settingsError) throw settingsError;
    if (!objectPath) {
      res.status(404).json({ error: "APK is not published yet" });
      return;
    }
    await pipeFile(getPrivateFile(objectPath), res, fileName || DEFAULT_APK_FILE_NAME);
  } catch (error) {
    req.log.error({ err: error }, "APK download failed");
    if (!res.headersSent) res.status(500).json({ error: "Unable to download APK" });
  }
});

router.post("/admin/app/apk-upload-url", requireAdmin, async (req, res): Promise<void> => {
  const { fileName, size, contentType } = req.body as Record<string, unknown>;
  if (typeof fileName !== "string" || !fileName.toLowerCase().endsWith(".apk")) {
    res.status(400).json({ error: "Choose a valid .apk file" });
    return;
  }
  if (typeof size !== "number" || size < 1 || size > MAX_APK_BYTES) {
    res.status(400).json({ error: "APK must be smaller than 300 MB" });
    return;
  }
  if (contentType !== "application/vnd.android.package-archive" && contentType !== "application/octet-stream") {
    res.status(400).json({ error: "Unsupported APK content type" });
    return;
  }
  try {
    res.json(await createApkUpload());
  } catch (error) {
    req.log.error({ err: error }, "APK upload URL creation failed");
    res.status(500).json({ error: "Unable to prepare APK upload" });
  }
});

router.post("/admin/app/apk-publish", requireAdmin, async (req, res): Promise<void> => {
  const { objectPath, fileName, size } = req.body as Record<string, unknown>;
  if (typeof objectPath !== "string" || typeof fileName !== "string" || typeof size !== "number") {
    res.status(400).json({ error: "Invalid APK publication details" });
    return;
  }
  try {
    const file = getPrivateFile(objectPath);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(400).json({ error: "Uploaded APK was not found" });
      return;
    }
    const updatedAt = new Date().toISOString();
    await Promise.all([
      writeValue("apk_object_path", objectPath),
      writeValue("apk_file_name", fileName),
      writeValue("apk_file_size", String(size)),
      writeValue("apk_updated_at", updatedAt),
    ]);
    res.json({ available: true, fileName, size, updatedAt, downloadUrl: "/api/app/apk" });
  } catch (error) {
    req.log.error({ err: error }, "APK publication failed");
    res.status(500).json({ error: "Unable to publish APK" });
  }
});

export default router;