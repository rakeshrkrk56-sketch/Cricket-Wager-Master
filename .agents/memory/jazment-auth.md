---
name: Jazment authentication
description: Durable identity and session-security constraints for Jazment
---

**Rule:** Normalize Indian phone inputs to one canonical identity before lookup or creation, and never provide a mock OTP fallback.

**Why:** Inconsistent phone formats previously split one person's balance and history across duplicate accounts; predictable OTPs let strangers access funded wallets.

**How to apply:** All login paths must share the same server-side normalization and a real provider verification result. Provider outages should fail explicitly.

**Rule:** Session tokens must be signed and expiring; unsigned legacy tokens are invalid.

**Why:** A decodable but unsigned user identifier can be forged to read or debit another user's wallet.

**How to apply:** HTTP and WebSocket authentication must use the same verified session identity. Never accept a client-asserted role without loading the current user record.