---
name: React Native SVG web props
description: Cross-platform accessibility behavior for react-native-svg components in the Expo web preview
---

Keep boolean accessibility props such as `accessible` and `accessibilityElementsHidden` off `react-native-svg` nodes when they render in Expo web.

**Why:** Expo web can forward those props directly to the DOM, producing invalid-attribute console errors even though the same props are accepted by native React Native.

**How to apply:** Prefer controlling accessibility on the containing React Native view or button. Keep SVG nodes focused on their visual geometry and supported SVG props.