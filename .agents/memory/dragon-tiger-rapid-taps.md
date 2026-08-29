---
name: Dragon Tiger rapid taps
description: Reliability rule for chip-first and side-first betting interactions during short rounds.
---

Dragon Tiger betting choices and chip selections must update a synchronous lock before waiting for React state to render. The first chosen side remains locked until the round result.

**Why:** Back-to-back taps within one render frame can read stale component state, allowing a second side to replace the first or preventing a chip-first wager from being submitted.

**How to apply:** For any short-timer wagering control, use synchronous current-value references for interaction decisions and React state for rendering. Reset both together only when the server announces a new round.