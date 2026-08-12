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

## SMS Provider: Fast2SMS OTP API (switched from MSG91)
- MSG91 was abandoned: it accepted sends (`type: success` + request_id) but Indian carriers silently dropped delivery because the user has no DLT entity/sender/template registration. Fast2SMS handles DLT on the reseller side.
- Send: `POST https://www.fast2sms.com/dev/otp/send` body `{ mobile, otp_id, otp_length, otp_expiry }`, API key in `Authorization` header
- Verify: `POST https://www.fast2sms.com/dev/otp/verify` body `{ mobile, otp }`
- Success check: `response.ok && body.return === true` (providers can return HTTP 200 with error body)
- Fast2SMS wants a bare 10-digit mobile (strip `+91`); Jazment still canonicalizes to `+91XXXXXXXXXX` internally
- Config: `FAST2SMS_API_KEY` (secret), `FAST2SMS_OTP_ID` (OTP template ID from Fast2SMS dashboard)
- 60-second resend cooldown tracked in-memory (`otpSentAt` Map)

**Why:** Replaced mock `1234` OTP to prevent unauthorized account access before real users deposit money.

**How to apply:** All OTP logic is self-contained in `artifacts/api-server/src/routes/auth.ts`. Token format and middleware are unchanged.

## Mobile auth flow
- `contexts/AuthContext.tsx` holds token + user state
- `setAuthTokenGetter` from `@workspace/api-client-react` is called in useEffect when token changes
- `app/_layout.tsx` calls `setBaseUrl()` at module level (outside components) so it runs before any hook
- Redirect logic: `(tabs)/_layout.tsx` redirects to `/login` if no token
