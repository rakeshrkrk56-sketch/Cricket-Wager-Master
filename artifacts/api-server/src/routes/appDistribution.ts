import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { Router, type IRouter, type Request, type Response } from "express";
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

type LocalApk = { path: string; fileName: string; size: number; updatedAt: string };

/**
 * VPS fallback: when APK_FILE_PATH points to an existing regular file, that file
 * is the published APK. It is checked BEFORE any database or Object Storage
 * lookup, so it needs neither a "published" row nor the storage sidecar.
 * Returns null when the variable is unset or the file is missing so callers keep
 * the existing Object Storage behavior.
 */
async function getLocalApk(): Promise<LocalApk | null> {
  const localPath = process.env.APK_FILE_PATH?.trim();
  if (!localPath) return null;
  try {
    const info = await stat(localPath);
    if (!info.isFile()) return null;
    return {
      path: localPath,
      fileName: basename(localPath) || DEFAULT_APK_FILE_NAME,
      size: info.size,
      updatedAt: info.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

async function streamLocalApk(req: Request, res: Response, apk: LocalApk): Promise<void> {
  res.status(200);
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", `attachment; filename="${apk.fileName.replace(/[^\w.-]/g, "_")}"`);
  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("Content-Length", String(apk.size));
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    createReadStream(apk.path).on("error", reject).on("end", resolve).pipe(res);
  });
}

async function writeValue(key: string, value: string) {
  await db.insert(platformSettingsTable)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value, updatedAt: new Date() } });
}

router.get("/app/apk-info", async (_req, res): Promise<void> => {
  const localApk = await getLocalApk();
  if (localApk) {
    res.json({
      available: true,
      fileName: localApk.fileName,
      size: localApk.size,
      updatedAt: localApk.updatedAt,
      downloadUrl: "/api/app/apk",
    });
    return;
  }
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
    // Local file first: no database or Object Storage dependency on the VPS.
    const localApk = await getLocalApk();
    if (localApk) {
      await streamLocalApk(req, res, localApk);
      return;
    }
    const [objectPath, fileName] = await Promise.all([
      readValue("apk_object_path"),
      readValue("apk_file_name"),
    ]);
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