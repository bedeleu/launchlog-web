# LaunchLog Release Catalog visual system

This file records the implemented UI contract. It is descriptive, not a roadmap.

## Direction

LaunchLog is a release catalog: a permanent editorial record of what shipped. The interface borrows from numbered catalog editions, printed sleeves, proof sheets, and operational registers. It is not a generic AI dashboard and does not imitate a component-library demo.

## Materials

| Token | Value | Use |
|---|---|---|
| Ink | `#080907` | primary canvas |
| Rail | `#11130f` | inset operational panels and fields |
| Paper | `#e8e0cf` | primary actions, labels, light specimens |
| Paper muted | `#c9c0ae` | supporting copy |
| Blaze | `#ff4b1f` | active evidence, navigation, editorial emphasis |
| Signal | `#24c58b` | verified success only |
| Warning | `#f4b33c` | recoverable attention states |
| Destructive | `#e44c3f` | destructive actions and failures |
| Focus | `#ffbf29` | keyboard focus treatment |

Product screenshots keep their source color. The surrounding product UI does not introduce purple, violet, indigo, mauve, gradients, glow, glass, backdrop blur, or decorative color effects.

## Typography

- Geist Variable is the reading and interface face, with Inter/system fallbacks.
- Geist Mono Variable is the catalog metadata face, with JetBrains Mono/system fallbacks.
- Mono is used for release IDs, kickers, registers, domains, state labels, and evidence metadata—not for long prose.
- Headings use compact leading and restrained scale. Metadata supports content rather than becoming decoration.

## Composition

- Near-square corners, one-pixel seams, and flat material changes define hierarchy.
- Public discovery uses release covers and catalog rails; evidence remains dominant.
- The URL-first publishing flow keeps one canonical path: capture, review, choose placement, publish.
- Standard and Featured share the same record contract. Featured changes placement composition, not the truthfulness or machine-readable evidence.
- Customer and admin surfaces use operational registers and stable action rails. Admin creation reuses the same URL-first onboarding instead of a second manual form.
- Reading pages use the shared reading shell and a narrow prose measure.

## Interaction states

- Every modified control has explicit default, hover, focus-visible, active/selected, disabled, loading, validation, and destructive treatment where applicable.
- Primary actions are warm paper on ink. Secondary actions are transparent with seams. Focus uses the yellow focus token and never depends on color alone.
- Success uses signal green plus text/icon/state labels. Warning and destructive states have distinct copy and structure.
- Loading placeholders preserve final geometry. Saved/dirty feedback uses a stable action region and does not shift the page.
- Motion is short and functional; reduced-motion users keep all information without animated travel.

## Ownership

- `app/assets/css/tailwind.css` owns material tokens and shared Release Catalog primitives.
- `app/components/ReleaseCatalog/` owns reusable catalog frames and release anatomy.
- `app/components/Listing/` owns public listing cards and screenshot presentation.
- `app/components/Intake/` owns URL intake, capture, preview states, duplicate resolution, and placement proof.
- `app/components/Content/` owns reading shells.
- Page files own route composition and data orchestration, not new visual dialects.

## Prohibited regressions

- No compatibility `brand-*`, chart, or sidebar palettes on Release Catalog surfaces.
- No default browser or component-library appearance on modified controls or overlays.
- No duplicate canonical forms, duplicate Save steps, or separate admin onboarding.
- No nested default-layout `<main>` landmarks.
- No screenshot stretching or aspect-ratio cropping that falsifies the captured evidence.
- No decorative pill/bento treatment for ordinary labels or content groups.

## Reference captures

- `review/desktop.png`, `review/tablet.png`, `review/mobile.png`: current Phase E public surface matrix.
- `review/hero-repro.png`: current Phase E private preview proof composition.
- `review/login-desktop.png`, `review/login-mobile.png`: final account-access composition.
- `review/pricing-desktop.png`: final edition comparison.
- `review/submit-mobile.png`: final URL-first mobile capture.
