---
name: Expo shared subpath preview
description: Replit shared-proxy routing constraints for an Expo Router web preview mounted below a path prefix
---

When an Expo Router web preview shares a Replit domain with a root web service, route Metro's distinct bundle and asset URL prefixes to Expo rather than letting the root service catch them. Use a production-mode Metro bundle for a non-root `baseUrl`.

**Why:** Metro's development HTML emits root-relative bundle and asset requests. A root Vite service can silently answer the bundle request with HTML, while Expo Router 6 deliberately does not strip `EXPO_BASE_URL` from incoming paths in development bundles. The first failure looks like a generic Preview error; fixing only the bundle route then exposes a router not-found screen.

**How to apply:** For any Expo preview mounted under a shared-domain subpath, verify the entry bundle's MIME type through the shared proxy, route only Expo-specific asset prefixes away from the root web service, and ensure the bundle runs with `dev=false` before browser-testing the prefixed route.