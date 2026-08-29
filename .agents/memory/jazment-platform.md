---
name: Jazment platform overview
description: Durable product boundaries and fairness rules for the Jazment Dragon Tiger platform
---

Jazment is a real-time Dragon Tiger gaming platform with a mobile player app, admin operations panel, API server, and shared PostgreSQL database.

**Rule:** Preserve users, authentication, wallets, payment flows, KYC, support, notifications, audit history, and historical cricket records. Cricket is no longer an active runtime feature.

**Why:** The product changed games without becoming a new account or payments system; users must keep their money and history.

**How to apply:** New user-facing game work should target Dragon Tiger. Do not revive cricket endpoints or delete old data unless the user explicitly requests a separate migration.

**Rule:** Results must remain fair and server-controlled. AUTOMATIC and MANAGED modes may change operational behavior, but neither may select outcomes or optimize platform profit.

**Why:** Hidden outcome manipulation would violate player trust and create serious legal and ethical risk.

**How to apply:** Generate cards with cryptographically secure randomness. Admin controls may pause, close betting, and monitor exposure only.
