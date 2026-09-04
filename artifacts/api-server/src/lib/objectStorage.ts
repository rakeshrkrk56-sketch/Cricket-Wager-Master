import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { Storage, type File } from "@google-cloud/storage";

const SIDECAR = "http://127.0.0.1:1106";

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function privateDirectory(): string {
  const value = process.env.PRIVATE_OBJECT_DIR;
  if (!value) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  return value.replace(/\/$/, "");
}

function parsePath(value: string) {
  const parts = value.replace(/^\//, "").split("/");
  if (parts.length < 2) throw new Error("Invalid object path");
  return { bucket: parts[0], object: parts.slice(1).join("/") };
}

async function signedUrl(bucket: string, object: string): Promise<string> {
  const response = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucket,
      object_name: object,
      method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Unable to create upload URL (${response.status})`);
  const body = await response.json() as { signed_url?: string };
  if (!body.signed_url) throw new Error("Upload URL missing");
  return body.signed_url;
}

export async function createApkUpload() {
  const fullPath = `${privateDirectory()}/apk/${randomUUID()}.apk`;
  const { bucket, object } = parsePath(fullPath);
  return {
    uploadUrl: await signedUrl(bucket, object),
    objectPath: `/objects/${object.slice(parsePath(privateDirectory()).object.length + 1)}`,
  };
}

export function getPrivateFile(objectPath: string): File {
  if (!objectPath.startsWith("/objects/")) throw new Error("Invalid object path");
  const fullPath = `${privateDirectory()}/${objectPath.slice("/objects/".length)}`;
  const { bucket, object } = parsePath(fullPath);
  return storage.bucket(bucket).file(object);
}

export async function pipeFile(file: File, res: import("express").Response, fileName: string) {
  const [metadata] = await file.getMetadata();
  res.setHeader("Content-Type", metadata.contentType || "application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(/[^\w.-]/g, "_")}"`);
  res.setHeader("Cache-Control", "public, max-age=300");
  if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
  Readable.toWeb(file.createReadStream());
  file.createReadStream().pipe(res);
}