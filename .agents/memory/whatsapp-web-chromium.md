---
name: WhatsApp Web Chromium
description: Replit runtime requirements for launching the unofficial WhatsApp Web OTP sender
---

The WhatsApp Web sender must keep Puppeteer as a direct API dependency and launch the Nix-installed Chromium through an absolute executable path.

**Why:** The API bundle left Puppeteer as a runtime require that pnpm did not expose when it was only transitive, and Puppeteer does not resolve a bare `chromium` command name as its executable path.

**How to apply:** When changing WhatsApp Web or Puppeteer versions, keep them compatible, retain the system Chromium dependency, and confirm the API reaches either the QR-waiting or ready state after restart.