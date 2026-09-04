---
name: WhatsApp Web Chromium
description: Replit runtime requirements for launching the unofficial WhatsApp Web OTP sender
---

The WhatsApp Web sender must keep Puppeteer as a direct API dependency, launch Nix Chromium through an absolute path, and track the browser client before initialization finishes so shutdown can always destroy it. Do not assume `LocalAuth` remains linked after a fresh VM publish.

**Why:** The API bundle left Puppeteer as a runtime require that pnpm did not expose when it was only transitive, Puppeteer does not resolve a bare `chromium` command name, and pre-ready restarts otherwise leave stale browser processes that block the next session. A fresh VM runtime can start with no linked-device state and remain `waiting_for_qr`, so OTPs stop even while the API and domain are healthy.

**How to apply:** When changing WhatsApp Web or Puppeteer versions, keep them compatible, retain system Chromium, clean up initializing clients on shutdown, and confirm the production status is `ready`, not merely QR-waiting, after every publish. Use durable remote auth if publish-time relinking is unacceptable.