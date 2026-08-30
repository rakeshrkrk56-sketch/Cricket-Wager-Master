import app from "./app";
import { logger } from "./lib/logger";
import { createServer } from "node:http";
import { dragonTigerGame } from "./game/dragonTiger";
import { pool } from "@workspace/db";
import { startWhatsAppClient, stopWhatsAppClient } from "./lib/whatsappClient";
import { deleteExpiredSupportScreenshots } from "./jobs/supportCleanup";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
dragonTigerGame.attach(server);
const supportCleanupTimer = setInterval(() => {
  void deleteExpiredSupportScreenshots().catch((err) => {
    logger.error({ err }, "Support screenshot cleanup failed");
  });
}, 24 * 60 * 60 * 1000);
supportCleanupTimer.unref();
server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
server.listen(port, () => {
  logger.info({ port }, "Server listening");
  void deleteExpiredSupportScreenshots().catch((err) => {
    logger.error({ err }, "Support screenshot cleanup failed");
  });
  void startWhatsAppClient().catch((err) => {
    logger.error({ err }, "WhatsApp OTP client failed to initialize");
  });
});

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    logger.warn({ signal }, "Forcing server shutdown");
    process.exit(1);
  }
  shuttingDown = true;
  logger.info({ signal }, "Graceful server shutdown started");
  const deadline = setTimeout(() => {
    logger.error("Graceful server shutdown timed out");
    process.exit(1);
  }, 10_000);
  deadline.unref();

  try {
    const httpClosed = new Promise<void>((resolve, reject) => {
      server.close((err) => err ? reject(err) : resolve());
    });
    clearInterval(supportCleanupTimer);
    await Promise.all([httpClosed, dragonTigerGame.stop(), stopWhatsAppClient()]);
    await pool.end();
    clearTimeout(deadline);
    logger.info("Graceful server shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Graceful server shutdown failed");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
