---
name: WhatsApp Web Chromium
description: Replit runtime requirements for launching the unofficial WhatsApp Web OTP sender
---

The WhatsApp Web sender must keep Puppeteer as a direct API dependency, launch Nix Chromium through an absolute path, and track the browser client before initialization finishes so shutdown can always destroy it.

**Why:** The API bundle left Puppeteer as a runtime require that pnpm did not expose when it was only transitive, Puppeteer does not resolve a bare `chromium` command name, and pre-ready restarts otherwise leave stale browser processes that block the next session.

**How to apply:** When changing WhatsApp Web or Puppeteer versions, keep them compatible, retain system Chromium, clean up initializing clients on shutdown, and confirm the API reaches QR-waiting or ready after restart.