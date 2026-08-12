---
name: Mock OTP auth pattern
description: How authentication works in Jazment (no real SMS provider)
---

## How it works
- Any phone number can register/login
- OTP field always accepts `1234` (hardcoded in `artifacts/api-server/src/routes/auth.ts`)
- Phone numbers are normalized SERVER-side to `+91XXXXXXXXXX` in both send-otp and verify-otp (`normalizePhone()` in routes/auth.ts). Never rely on clients formatting consistently — inconsistent formats ("9876543210" vs "+919876543210") once created duplicate accounts for the same number, losing wallet/prediction history on re-login.
- User creation is race-safe via `onConflictDoNothing` on the unique phone constraint + re-select.
- Token format: base64(`userId:role:timestamp`) stored in `localStorage` (web) / `AsyncStorage` (mobile)
- `parseToken()` in `middlewares/auth.ts` decodes and validates it

**Why:** No real SMS provider integrated yet; this enables full end-to-end testing without costs.

**How to apply:** When adding real SMS (e.g. Twilio), replace the OTP generation/validation in `routes/auth.ts` only — the token format and middleware can stay the same.

## Mobile auth flow
- `contexts/AuthContext.tsx` holds token + user state
- `setAuthTokenGetter` from `@workspace/api-client-react` is called in useEffect when token changes
- `app/_layout.tsx` calls `setBaseUrl()` at module level (outside components) so it runs before any hook
- Redirect logic: `(tabs)/_layout.tsx` redirects to `/login` if no token
