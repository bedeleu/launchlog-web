# Release Catalog Phase E performance audit

Audit date: 2026-08-28
Environment: deployed Phase D production for browser timings; Phase E candidate for build and test gates. Measurements are observations, not universal score thresholds.

## Browser observations

Captured with buffered PerformanceObserver entries after network idle and font completion.

| Route / viewport | DCL | Load | LCP | LCP element | CLS | Longest measured interaction | Overflow |
|---|---:|---:|---:|---|---:|---:|---|
| Home / 1440×1000 | 482 ms | 609 ms | 604 ms | real release screenshot | 0.001 | none ≥16 ms | none |
| Browse All / 768×1024 | 407 ms | 407 ms | 528 ms | listing screenshot | 0 | 24 ms | none |
| Listing / 390×844 | 408 ms | 1,338 ms | 524 ms | listing screenshot | 0 | 16 ms | none |

Fonts reported `loaded` in every measured route. The private preview was reproduced without production mutation through a local mock API and the current production Nuxt build; `hero-repro.png` records the exact Phase E candidate at 1586×992. Authenticated customer state remains covered by the required private SSR and customer-dashboard unit suites without impersonating an account. The unauthenticated access shell `/login` loaded in 386 ms and all controls remained 44 px high.

## Route response payload

`curl --compressed` response body sizes from production:

| Route | HTTP | Compressed body |
|---|---:|---:|
| `/` | 200 | 10,862 B |
| `/browse-all` | 200 | 15,903 B |
| `/listing/seoauto-io` | 200 | 11,315 B |
| `/login` | 200 | 5,684 B |
| `/dashboard` access shell | 200 | 1,287 B |

Candidate production build output: 4.93 MB total server output, 1.17 MB gzip as reported by Nuxt. Portable output starts and serves without `.output/server/node_modules`.

## Images

- Catalog screenshots are delivered as 800×500 WebP and retain their 1.6:1 aspect ratio.
- Home hero screenshot rendered 741×463 at 1440; Browse cards rendered 332×206 at 768; listing screenshot rendered 313×195 at 390.
- Visible images loaded without console errors. Below-fold lazy images remain lazy until scrolled; a zero `naturalWidth` before intersection is not classified as broken.
- No measured regression justified speculative preload work.

## Gate result

- No LCP, CLS, font, image-ratio, interaction, or overflow regression was found.
- The Phase E semantic, touch-target, and visual-debt fixes add no network resources. The candidate build remains 4.93 MB total server output / 1.17 MB gzip.
- Final CI-equivalent candidate: 291 pre-build pass, 121 intentional SSR placeholders skipped, 84 required SSR pass, 21 directory SSR pass, lint 0 errors, typecheck/build/portable output pass.
