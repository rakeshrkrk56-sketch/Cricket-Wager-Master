---
name: Workspace build port isolation
description: Port collision constraint for concurrent Replit artifact workflows and production builds
---

**Rule:** Production build scripts that start a local development server must use a dedicated build port rather than assuming a common default port.

**Why:** Replit runs artifact development workflows alongside publish-time workspace builds. Another artifact can already own the default port, causing a non-interactive build to wait for a port prompt and time out even though the source compiles.

**How to apply:** Give temporary bundlers an explicit isolated port, allow an environment override, and use that same port for health checks, bundle URLs, manifests, and asset URLs.