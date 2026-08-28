# Release Catalog Phase E state matrix

Audit date: 2026-08-28
Candidate base: `af3f861e3694d2ff1efe895b4d2192650c4e2ca9`
Candidate fixes: `be34fec`, `c60af2a`, `242f050`, `89d6312`, `03b6794`, `d267efc`

`PASS` means the exact state has a named automated or visual proof. Screenshots capture the current Phase E candidate build; test evidence exercises the same candidate against the production-like Nuxt build.

## Public and publishing flow

| Surface / state | Result | Evidence |
|---|---|---|
| Home, desktop 1440 | PASS | `desktop.png`; live Playwright audit: 9/9 images loaded, no overflow or console error |
| Home, 200% reflow equivalent (720 CSS px) | PASS | live Playwright audit: no horizontal overflow; keyboard focus visible |
| URL submit, idle / invalid / submitting | PASS | `test/preview-form.test.ts`; `test/preview-status.test.ts` |
| Preview loading and slow capture | PASS | `test/preview-release-catalog.test.ts`; `test/preview-status.test.ts` |
| Preview ready, Standard | PASS | `test/preview-checkout-contract.test.ts`; `test/directory-ssr.test.ts` |
| Preview ready, Featured | PASS | `test/preview-checkout-contract.test.ts`; `test/preview-release-catalog.test.ts` |
| Preview proof composition, desktop 1586 | PASS | `hero-repro.png`; local mock API + production Nuxt build, one main landmark, no horizontal overflow |
| Preview failed / missing screenshot | PASS | `test/preview-status.test.ts`; fallback initials and copy asserted |
| Duplicate URL | PASS | `test/duplicate-release-notice.test.ts`; existing record and ownership routes asserted |
| Logged-out publishing identity | PASS | `test/preview-checkout-customer.test.ts`; email path remains explicit |
| Signed-in publishing identity | PASS | `test/preview-checkout-customer.test.ts`; verified account rendered without duplicate email input |
| Admin bypass | PASS | `test/admin-url-entry.test.ts`; direct Standard/Featured publish without Stripe |
| Stripe return pending | PASS | `test/preview-checkout-cancel.test.ts`; `test/preview-release-progress.test.ts` |
| Stripe return converted | PASS | `test/preview-release-progress.test.ts`; listing destination asserted |
| Stripe return expired / canceled | PASS | `test/preview-checkout-cancel.test.ts`; reservation release asserted |
| Browse All page 1, tablet 768 | PASS | `tablet.png`; live route 200; no overflow; 12/12 images loaded |
| Browse All page 2 | PASS | `test/directory-ssr.test.ts`; live `/browse-all?page=2` 200 |
| Featured directory | PASS | `test/directory-ssr.test.ts`; live `/featured` 200 |
| Tech directory | PASS | `test/directory-ssr.test.ts`; live `/tech-products` 200 |
| Listing detail, mobile 390 | PASS | `mobile.png`; live `/listing/seoauto-io` 200; schema/receipt SSR tests |
| Pricing | PASS | `test/tax-notice-ssr.test.ts`; live `/pricing` 200 |
| Blog archive and article | PASS | `test/blog-ssr.test.ts`; live `/blog` 200 |
| Contact and legal | PASS | live `/contact`, `/privacy`, `/terms` 200; one H1 and canonical each |
| Status | PASS | live `/status` 200; one H1 and canonical |
| 404 HTML | PASS | live `/definitely-not-a-release` 404, `noindex,nofollow`, “Record unavailable” |
| 503 error contract | PASS | `test/blog-ssr.test.ts`; temporary upstream failures remain retryable and index-safe |

## Customer and administration

| Surface / state | Result | Evidence |
|---|---|---|
| Customer dashboard empty | PASS | `test/customer-dashboard.test.ts` |
| Customer listing active | PASS | `test/customer-dashboard.test.ts`; billing and public destinations asserted |
| Customer listing archived | PASS | `test/customer-dashboard.test.ts`; archived state remains manageable |
| Customer save / dirty / saved | PASS | `test/customer-dashboard.test.ts`; stable action rail and dirty-state contract asserted |
| Customer API error | PASS | `test/customer-dashboard.test.ts`; inline error state asserted |
| Login Google / email / custom auth errors | PASS | `test/login-auth-ui.test.ts`; `test/auth-errors.test.ts` |
| Login Release Catalog composition, desktop/mobile | PASS | `login-desktop.png`, `login-mobile.png`; official Google mark, 44 px controls, one main landmark, no overflow |
| Admin registry loading / empty / populated | PASS | `test/admin-listings-index.test.ts` and targeted unit batch |
| Admin new URL entry | PASS | `test/admin-url-entry.test.ts` |
| Admin edit | PASS | `test/admin-listing-editor.test.ts` |
| Admin AI proposal | PASS | `test/admin-ai-proposal.test.ts` |
| Admin apply selected fields | PASS | `test/admin-ai-proposal.test.ts`; one explicit apply action |
| Admin publish / unpublish / reject / delete | PASS | `test/admin-listing-editor.test.ts`; `test/admin-url-entry.test.ts` |
| Outreach draft / validation / send result | PASS | component contract present; no external send performed in Phase E |

## Cross-cutting viewport and input checks

| Check | Result | Evidence |
|---|---|---|
| Long titles and descriptions | PASS | listing/customer/admin fixtures in targeted unit and SSR batches |
| Missing and real screenshots | PASS | preview/status unit tests; desktop/tablet/mobile captures |
| Keyboard-only order | PASS | live Playwright Tab sequence follows header → page controls |
| Focus-visible | PASS | live search focus: 2 px Release yellow border/ring; no hidden outline |
| Reduced motion | PASS | transition scan and CSS media contract; no required information depends on motion |
| 200% zoom / reflow | PASS | 720 CSS px Home audit: no overflow and controls remain reachable |
| Horizontal overflow | PASS | 1440, 768, 390 and 720 audits all returned `scrollWidth <= clientWidth` |
| Landmarks | PASS after bounded fixes | RED found two Home `<main>` elements; the final structural test covers ten default-layout pages and prevents page wrappers from reintroducing a second landmark |

## Test ledger

- CI-equivalent pre-build suite: **291 pass / 121 intentional SSR placeholders skipped / 0 fail** across 64 files.
- Required post-build SSR matrix: **84 pass / 0 fail** across six files.
- Required directory SSR: **21 pass / 0 fail**.
- Release Catalog Admin selector regression: **9 pass / 0 fail** after RED → GREEN.
- Main-landmark regression: **21 pass / 0 fail** after RED → GREEN (`/tmp/phase-e-main-landmark-green.log`).
- Public routes: all expected success/error statuses and SEO headers recorded in `/tmp/phase-e-public-routes.log`.
- Independent Impeccable finish review: **SHIP** after two correction rounds (`finish-review.md`).
