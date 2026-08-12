---
name: CricAPI provider quirks
description: Non-obvious behaviors of the CricAPI/CricketData.org integration used for the display-only live scorecard
---

# CricAPI provider quirks

- **`match_score` is not on the free/low-cost tier.** It fails with `status: "failure", reason: "Invalid API requested"`. Use **`match_info`** instead — it returns the same `score[]` array (r/w/o per inning) plus toss, venue, teamInfo, and `matchStarted`/`matchEnded` flags.
  - **Why:** switching endpoints was the fix when the score proxy returned 503 despite a valid key.
  - **How to apply:** any new provider call for per-match data should go through `match_info`, not `match_score`.
- **Quota is tiny:** free tier is ~100 hits/day. Every response includes `info.hitsToday` and `info.hitsLimit` — usable for adaptive throttling.
- **Upcoming fixtures of active series are NOT in `currentMatches` or `matches`** — those lists only carry live/recent games plus a few far-future tours. To get the next match of a live series (e.g. the 5th ODI of an ongoing tour, remaining league fixtures), call `series_info?id=<series_id>` (series_id comes on each `currentMatches` row) and read `data.matchList`. Cache series fixtures for hours — they rarely change.
- **Every CricAPI response echoes the API key in the `apikey` field.** Never log or paste raw provider responses; strip that field first.
- **Business rule:** cricket scores are display-only. Admins settle all bet markets manually; provider data must never trigger settlement.
