# Release Catalog Phase E accessibility audit

Audit date: 2026-08-28
Scope: public catalog, publishing flow, customer access, and administration surfaces changed by Phases A–D.

## Automated and structural checks

- The repository has no Axe dependency; no substitute score is claimed. The audit used semantic DOM inspection, the production-like SSR suites, source contracts, keyboard traversal, and browser measurements.
- Live route audit found exactly one H1 and one canonical on every public success route sampled.
- Heading order on Home, Browse All, and listing detail has no skipped level.
- Images in the visible viewport have useful alt text or are intentionally decorative.
- Inputs, selects, textareas, buttons, and icon-only controls expose an accessible name.
- HTML 404 returns `404`, `noindex,nofollow`, one H1, and the Release Catalog error shell. The 503 path remains retryable and does not acquire a permanent noindex directive.
- Targeted state units: 81 pass / 0 fail. Production-like state SSR: 102 pass / 0 fail.

## Manual interaction checks

| Check | Result |
|---|---|
| Keyboard order | PASS — header navigation, page controls, result cards, and footer follow visual/source order. |
| Focus visibility | PASS — explicit 2 px Release yellow focus treatment; input focus also has a visible border/ring. |
| Error association | PASS — form errors use visible inline copy and alert/status semantics; auth errors are translated from Firebase codes. |
| Dialog/drawer containment | N/A — no modified Phase E surface introduces a dialog or drawer. |
| Reduced motion | PASS — information is not motion-dependent; reduced-motion CSS preserves state changes without animated travel. |
| 200% zoom | PASS — 720 CSS px reflow audit has no horizontal overflow and keeps controls reachable. |
| Touch targets | PASS after bounded fix — footer “X” was measured at 8×17 px; `c60af2a` pins a minimum 24 px target for footer links. |
| Landmarks | PASS after bounded fixes — `be34fec` removed the deployed Home duplicate; the final structural gate now asserts that the default layout owns the sole main landmark across ten public, customer, checkout, preview, and admin pages. |

## Contrast

Calculated against Release ink `#070a06`:

| Token | Ratio | Result |
|---|---:|---|
| Paper `#e8e0cf` | 15.16:1 | PASS |
| Paper muted `#b8ad99` | 8.98:1 | PASS |
| Blaze `#ff4b21` | 5.95:1 | PASS for normal text |
| Signal `#31d6a0` | 10.67:1 | PASS |
| Focus `#ffbf29` | 12.07:1 | PASS |
| Destructive `#ff5c5c` | 6.58:1 | PASS |

Color is never the only state signal: status copy, icons, borders, or labels accompany semantic colors.

## Evidence

- Viewport captures: `desktop.png`, `tablet.png`, `mobile.png`.
- Full matrix: `state-matrix.md`.
- Main landmark RED→GREEN: `/tmp/phase-e-main-landmark-green.log`.
- Footer target RED→GREEN: `app/components/Content/reading-shell.test.ts`.
- Final cross-surface landmark contract: `test/release-catalog-landmarks.test.ts`.
- Live public route/SEO response ledger: `/tmp/phase-e-public-routes.log`.
