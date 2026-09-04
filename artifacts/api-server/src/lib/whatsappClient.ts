import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { execFileSync } from "node:child_process";
import { logger } from "./logger";

let client: Client | null = null;
let initialization: Promise<Client> | null = null;
let latestQr: string | null = null;
let status: "starting" | "waiting_for_qr" | "ready" | "disconnected" | "error" = "starting";
const CHROMIUM_LAUNCH_TIMEOUT_MS = 120_000;

function createClient(): Client {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
    ?? execFileSync("which", ["chromium"], { encoding: "utf8" }).trim();
  const nextClient = new Client({
    authStrategy: new LocalAuth({ clientId: "jazment-otp" }),
    puppeteer: {
      headless: true,
      executablePath,
      timeout: CHROMIUM_LAUNCH_TIMEOUT_MS,
      protocolTimeout: CHROMIUM_LAUNCH_TIMEOUT_MS,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--no-first-run",
      ],
    },
  });

  nextClient.on("qr", (qr) => {
    latestQr = qr;
    status = "waiting_for_qr";
    logger.warn("Scan this WhatsApp OTP QR code with the WhatsApp account that will send OTPs");
    qrcode.generate(qr, { small: true });
  });
  nextClient.on("ready", () => {
    latestQr = null;
    status = "ready";
    logger.info("WhatsApp OTP client is ready");
  });
  nextClient.on("authenticated", () => {
    status = "starting";
    logger.info("WhatsApp OTP client authenticated");
  });
  nextClient.on("auth_failure", (message) => {
    status = "error";
    logger.error({ message }, "WhatsApp OTP authentication failed");
  });
  nextClient.on("disconnected", (reason) => {
    logger.warn({ reason }, "WhatsApp OTP client disconnected");
    latestQr = null;
    status = "disconnected";
    client = null;
    initialization = null;
  });

  return nextClient;
}

export function startWhatsAppClient(): Promise<Client> {
  if (initialization) return initialization;
  if (client && status === "ready") return Promise.resolve(client);

  const nextClient = createClient();
  client = nextClient;
  status = "starting";
  initialization = nextClient.initialize()
    .then(() => {
      return nextClient;
    })
    .catch(async (error) => {
      status = "error";
      initialization = null;
      await nextClient.destroy().catch((destroyError) => {
        logger.warn({ err: destroyError }, "Unable to clean up failed WhatsApp browser launch");
      });
      if (client === nextClient) client = null;
      throw error;
    });
  return initialization;
}

export function getWhatsAppClientStatus() {
  return { status, qr: latestQr };
}

export async function sendWhatsAppOtp(phone: string, otp: string): Promise<void> {
  const whatsapp = await Promise.race([
    startWhatsAppClient(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("WhatsApp client is waiting for QR authentication")), 15_000).unref();
    }),
  ]);
  const mobile = phone.replace(/\D/g, "");
  const numberId = await whatsapp.getNumberId(mobile);
  if (!numberId) {
    throw new Error("This mobile number is not registered on WhatsApp");
  }
  await whatsapp.sendMessage(
    numberId._serialized,
    `Your Jazment verification code is ${otp}. It expires in 10 minutes. Do not share this code.`,
  );
}

export async function stopWhatsAppClient(): Promise<void> {
  if (!client) return;
  const current = client;
  client = null;
  initialization = null;
  await current.destroy().catch((error) => {
    logger.warn({ err: error }, "Unable to cleanly close WhatsApp browser");
  });
}