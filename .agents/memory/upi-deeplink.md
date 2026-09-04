---
name: UPI deeplink safety
description: Durable rules for Jazment direct UPI payment intents
---

**Rule:** Keep Jazment direct UPI payment intents minimal: payee address (`pa`), exact two-decimal amount (`am`), and currency (`cu=INR`). Do not invent merchant, category, transaction, or reference parameters.

**Why:** The configured UPI ID accepts manual payments, while a deeplink with extra or incorrect request metadata can be routed differently by banks and fail with misleading limit errors.

**How to apply:** Encode the payee and amount, preserve the configured UPI ID and minimum amount, and validate every supported amount by parsing the generated URI before release. Keep proof submission separate from launching the UPI app.