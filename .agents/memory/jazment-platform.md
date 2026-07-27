---
name: Jazment platform overview
description: Architecture and key decisions for the Jazment cricket prediction platform
---

## Artifacts
- `artifacts/admin` — React/Vite admin panel at `/` (dark "Command Center" aesthetic)
- `artifacts/mobile` — Expo mobile app at `/mobile/` (user-facing cricket prediction app)
- `artifacts/api-server` — Express + TypeScript API at `/api-server/`

## DB (lib/db)
Tables: `users`, `matches`, `markets`, `predictions`, `transactions`
Schema push: `pnpm --filter @workspace/db run push`

## Design tokens (both artifacts share the same palette)
- Background: `#0F1729` (hsl 222 47% 11%)
- Primary: `#F47D1C` (hsl 28 90% 55%) — saffron orange
- Card: `#131E2F`, Border: `#1D2A3B`, Muted fg: `#8EA3BC`

## API client codegen
Spec: `lib/api-spec/openapi.yaml`
Run: `pnpm --filter @workspace/api-spec run codegen`
Generated hooks in: `lib/api-client-react/src/generated/api.ts`

## Cricket data
`/api/cricket/live` and `/api/cricket/score/:id` — uses `CRICAPI_KEY` env var, falls back to mock if not set

## Seeded test data
- Admin: +910000000000 (OTP: 1234)
- Users: +91987654321[0-4] (OTP: 1234)
- Matches: match-001 (India vs Australia, live), match-003 (CSK vs MI, live), etc.
- Markets: mkt-001 to mkt-011
