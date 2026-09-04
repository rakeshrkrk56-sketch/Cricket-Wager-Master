---
name: Expo Android signed preview
description: Why physical Expo Go needs an authenticated Replit Metro process even when the phone uses the correct Expo account
---

Authenticate the Replit Expo CLI with an `EXPO_TOKEN` from the Expo account that owns the project whenever a physical phone opens the development preview.

**Why:** The Expo account logged into the phone does not authenticate the Metro process running on Replit. Without a CLI token, Android requests trigger an interactive login prompt; offline mode bypasses the prompt but cannot fetch a development certificate, so physical Expo Go rejects the unsigned manifest.

**How to apply:** Store the owner account token as the `EXPO_TOKEN` Replit Secret, run Metro online, and verify `expo whoami` matches the project owner. Confirm a physical-style `expo-root` signing request returns a multipart manifest and its Android JavaScript bundle returns HTTP 200. Use offline mode only as a temporary simulator diagnostic.