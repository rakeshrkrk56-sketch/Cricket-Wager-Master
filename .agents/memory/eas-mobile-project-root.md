---
name: EAS mobile project root
description: Prevent EAS initialization and Android builds from using accidental workspace-root Expo configuration.
---

Run Expo EAS initialization, updates, and Android builds from the actual mobile artifact directory, never the pnpm workspace root. Remove accidental root-level Expo/EAS configuration rather than letting it coexist.

**Why:** Workspace-root initialization created an empty Expo config plus a generic build profile, while the real Jazment app lived in the mobile artifact. A build from the wrong root can succeed yet contain stale or incomplete app behavior.

**How to apply:** Before any EAS operation, confirm the working directory is the mobile artifact and verify the resolved app name, Android package, EAS project ID, update channel, and production API domain.