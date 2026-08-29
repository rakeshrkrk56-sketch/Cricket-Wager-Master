---
name: Admin session failures
description: How the admin UI must handle expired or invalid sessions when loading operational queues.
---

Admin queue pages must never translate an authorization or network failure into an empty list. Invalid sessions should be cleared and redirected to login; other failures should show a retryable error.

**Why:** A stale token can leave the admin shell looking authenticated while protected requests fail, misleading operators into believing pending deposits or withdrawals do not exist.

**How to apply:** Validate persisted admin sessions against a protected endpoint, handle 401/403 consistently, and render loading, error, and genuinely empty states separately on every operational queue.