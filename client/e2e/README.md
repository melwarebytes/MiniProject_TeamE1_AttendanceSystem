# Accessibility and browser checks (TC-18)

`npm run test:e2e` starts Vite and runs the key public, admin, faculty and student
pages through axe-core's WCAG 2.1 A/AA rules, plus a keyboard-only attendance
submission, at 360 px and 1920 px. Playwright installs Chromium, Chrome, Edge, Firefox and WebKit.
The API is mocked with deterministic data here; backend authorization, imports,
reports and retention are separately tested against real PostgreSQL/Redis.

These tests cover browser engines and catch regressions. Automated axe scans
cannot establish complete WCAG conformance. Before release, record manual
screen-reader, zoom, touch, iOS touch browsing and previous-major-version checks,
and the NFR-05 faculty usability survey. The CI reports record exact browser versions.

`node e2e/safari.mjs` additionally runs the installed Apple Safari on a macOS CI
runner through native SafariDriver. It checks 15 pages at both widths and two
keyboard submissions (32 checks). A same-origin iframe provides the exact CSS
viewport because Safari desktop windows have a minimum width. CI enables
Safari's Tab-to-controls setting. This is desktop Safari, not an iPhone emulator.

`node e2e/live-demo.mjs` uses the freshly seeded Docker deployment, logs in as
all three roles, checks 12 screens, downloads CSV/PDF reports, and records
screenshots/videos. It does not intercept API requests. Run it only against the
disposable localhost demo stack, not a production installation.
