---
name: OTP auth pattern
description: How authentication works in Jazment — real SMS via MSG91 OTP API
---

## How it works
- Any Indian phone number can register/login via real SMS OTP (MSG91)
- Phone numbers are normalized SERVER-side to `+91XXXXXXXXXX` in both send-otp and verify-otp (`normalizePhone()` in routes/auth.ts). Never rely on clients formatting consistently — inconsistent formats once created duplicate accounts for the same number.
- User creation is race-safe via `onConflictDoNothing` on the unique phone constraint + re-select.
- Token format: base64(`userId:role:timestamp`) stored in `AsyncStorage` (mobile)
- `parseToken()` in `middlewares/auth.ts` decodes and validates it

## SMS Provider: MSG91 OTP API
- Send OTP: `POST https://control.msg91.com/api/v5/otp?template_id=...&mobile=...&authkey=...`
- Verify OTP: `GET https://control.msg91.com/api/v5/otp/verify?otp=...&mobile=...` (authkey in header)
- MSG91 generates, sends, expires, and validates the OTP — Jazment stores nothing
- Credentials stored in Replit Secrets: `MSG91_AUTHKEY`, `MSG91_TEMPLATE_ID` (shared env var)
- 60-second resend cooldown tracked in-memory (`otpSentAt` Map)
- Phone passed to MSG91 as digits only (no leading `+`): `phone.slice(1)` from the `+91XXXXXXXXXX` form
- `providerSucceeded()` checks `response.ok` AND `body.type/status === "success"` — MSG91 can return HTTP 200 with an error body

**Why:** Replaced mock `1234` OTP to prevent unauthorized account access before real users deposit money.

**How to apply:** All OTP logic is self-contained in `artifacts/api-server/src/routes/auth.ts`. Token format and middleware are unchanged.

## Mobile auth flow
- `contexts/AuthContext.tsx` holds token + user state
- `setAuthTokenGetter` from `@workspace/api-client-react` is called in useEffect when token changes
- `app/_layout.tsx` calls `setBaseUrl()` at module level (outside components) so it runs before any hook
- Redirect logic: `(tabs)/_layout.tsx` redirects to `/login` if no token
