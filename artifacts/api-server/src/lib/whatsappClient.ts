import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { execFileSync } from "node:child_process";
import { logger } from "./logger";

let client: Client | null = null;
let initialization: Promise<Client> | null = null;
let latestQr: string | null = null;
let status: "starting" | "waiting_for_qr" | "ready" | "disconnected" | "error" = "starting";

function createClient(): Client {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
    ?? execFileSync("which", ["chromium"], { encoding: "utf8" }).trim();
  const nextClient = new Client({
    authStrategy: new LocalAuth({ clientId: "jazment-otp" }),
    puppeteer: {
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
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
  if (client) return Promise.resolve(client);
  if (initialization) return initialization;

  const nextClient = createClient();
  status = "starting";
  initialization = nextClient.initialize()
    .then(() => {
      client = nextClient;
      return nextClient;
    })
    .catch((error) => {
      status = "error";
      initialization = null;
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
  const chatId = `${phone.replace(/\D/g, "")}@c.us`;
  await whatsapp.sendMessage(chatId, `Your Jazment verification code is ${otp}. It expires in 10 minutes. Do not share this code.`);
}

export async function stopWhatsAppClient(): Promise<void> {
  if (!client) return;
  const current = client;
  client = null;
  initialization = null;
  await current.destroy();
}