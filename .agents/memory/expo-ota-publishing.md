---
name: Expo OTA publishing
description: Replit's supported process for delivering JavaScript updates to installed Expo binaries
---

Do not claim a specific Project Editor menu or managed OTA action exists unless it is visible in the current environment. Do not substitute a manual EAS CLI invocation from the workspace.

**Why:** A previous Jazment OTA publication proves the Expo project can receive updates, but it does not prove how that update was triggered. The current agent environment exposes only the Expo development workflow and no supported OTA publication callback, while the Expo workflow forbids manual EAS commands.

**How to apply:** Inspect current artifact/workflow actions first. If no managed OTA action is actually exposed, state that publication is blocked in the current session rather than inventing a menu location. The installed binary must still have a compatible runtime version and channel.