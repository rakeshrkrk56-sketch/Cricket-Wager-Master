---
name: APK release verification
description: Safety rule for distinguishing reference APKs from genuine Jazment release builds
---

**Rule:** Never expose an uploaded or attached APK through the Jazment landing page until its embedded package identity is Jazment and its embedded bundle/config markers match the current release source.

**Why:** An APK can have the correct `com.jazment.app` identity and still be an older broken build with missing current fixes. Publishing it creates a misleading download and is not fixed by package verification alone.

**How to apply:** Treat every new APK as untrusted release input. Inspect identity, embedded update/runtime configuration, and current-source markers; verify it is signed/installable; compare build provenance/timestamps; only then copy it to the public download path and enable download CTAs.