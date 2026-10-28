# Accessibility and browser checks (TC-18)

`npm run test:e2e` starts Vite and runs the key public, admin, faculty and student
pages through axe-core's WCAG 2.1 A/AA rules, plus a keyboard-only attendance
submission, at 360 px and 1920 px. Playwright installs Chromium, Chrome, Edge, Firefox and WebKit.
The API is mocked with deterministic data here; backend authorization, imports,
reports and retention are separately tested against real PostgreSQL/Redis.

These tests cover browser engines and catch regressions. Automated axe scans
cannot establish complete WCAG conformance. Before release, record manual
screen-reader, zoom, touch, actual Safari/iOS and previous-major-version checks,
and the NFR-05 faculty usability survey. The CI report records exact engines.
