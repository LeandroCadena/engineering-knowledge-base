# Compiled Tailwind CSS behavior

Requires Node.js 24/npm and Chromium installed for Playwright. Uses Tailwind CSS/CLI 4.3.5 and Playwright 1.65.0.

```bash
cd examples/tailwind-css
npm ci
npx playwright install chromium
npm test
npm run preview
```

Open `http://127.0.0.1:4177` while the preview is running. CI uses `npx playwright install --with-deps chromium` on its disposable runner. A compatible existing Chromium can be selected with `CHROMIUM_EXECUTABLE_PATH`; the default is Playwright's installed browser.

Four browser scenarios exercise real compiled CSS: complete-token theme mapping vs intentionally missing runtime concatenation; viewport grid vs container-specific flex layout; selector dark mode; and keyboard focus/native disabled styling. The parent test starts a loopback static server on an ephemeral port and closes the browser/server afterward. This is not a snapshot-only test of class strings.

`source(none)` disables automatic scanning for this fixture; `index.html` and `variants.mjs` are registered explicitly. The deliberately concatenated background class is an anti-example: no complete token is present in those sources, so the browser receives no corresponding rule. Production components should use full mappings, supported explicit source declarations or a stable class backed by a dynamic CSS variable.

The `md:` viewport breakpoint and `@sm:` container threshold use distinct scales. At desktop width the card can still become vertical when only its container is narrowed. The root `.dark` class drives the configured dark variant. Preference persistence, SSR theme initialization and system-mode synchronization are not implemented.

These assertions validate the fixture in Chromium, not every browser, full accessibility compliance, arbitrary content or a production application's visual design. The fixture uses semantic buttons; styles do not implement disabled or keyboard behavior by themselves.

Primary references:

- [Utilities and cascade](https://tailwindcss.com/docs/styling-with-utility-classes)
- [Source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files)
- [Theme variables](https://tailwindcss.com/docs/theme)
- [Viewport and container queries](https://tailwindcss.com/docs/responsive-design)
- [Interaction states](https://tailwindcss.com/docs/hover-focus-and-other-states)
- [Dark mode](https://tailwindcss.com/docs/dark-mode)
- [Upgrade guide](https://tailwindcss.com/docs/upgrade-guide)
