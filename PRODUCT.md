# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the visitor discovering indie tech — a maker, founder, or operator scanning for tools
worth trying, arriving from search or AI answers. When visitor and paying-founder interests
conflict, the visitor wins (confirmed 2026-08-17): the directory lives on traffic and trust, and
founders pay for that audience. Secondary: the indie maker or SaaS founder buying a listing.
Exactly two customer-facing plans (locked 2026-08-17): Standard $24.99/yr (internal identifier
`basic`) and Featured $99/yr — annual subscriptions only, USD only, no crossed-out anchor
prices, English only for MVP, global. Premium is retired as a sellable plan; a third product
returns only when there is a genuinely different deliverable to sell.

## Product Purpose

LaunchLog.ai is a curated paid directory for indie makers, SaaS founders, and tech launches —
"The log of what just shipped." Every listing is human-reviewed, gets a dedicated page, and is
built to be found by both search engines and AI systems. Success = visitors finding products they
try, and founders measurably discovered because they listed.

## Positioning

The invisible tech edge no neighboring directory truthfully offers as a package: schema.org
JSON-LD `@graph` on every listing page, dynamic `/llms.txt` and `/llms-full.txt`, and
content-negotiated markdown for `/listing/{slug}` via `Accept: text/markdown`. Human-reviewed
descriptions, not scraped dumps. Paid placement is disclosed honestly in the card's ledger
register, never hidden.

## Operating Context

Two production services on Railway: `launchlog-web` (Nuxt 4 SSR, launchlog.ai) and
`launchlog-api` (Laravel 13 + Octane, api.launchlog.ai), with Postgres, Redis, Firebase Auth,
Stripe, Cloudflare (DNS/proxy/R2 CDN for screenshots), Microlink screenshot enrichment, Resend
email. A merge to `main` auto-deploys. Directory pages are slot-aware: a mixed page owns 30
visual slots, the API plans page membership, and 504 published listings are equal across
directory, sitemap, and llms-full.txt. Locked product decisions live in the planning repo's
DECISIONS-LOG.md (D-001…D-064) and bind this repo's work.

## Capabilities and Constraints

- Listing CRUD, moderation, Firebase custom-claims auth, Stripe subscriptions, screenshot/meta
  enrichment, AI descriptions, spam gate, IndexNow, sitemap — all live in the API.
- Directory contract (D-064, two-plan revision locked 2026-08-17): Featured = 2 visual slots
  (2×1 at `lg`), Standard = 1 (1×1); page capacity 30 slots; at most 3 Featured per page,
  Featured ahead of Standard, overflow carrying onto following numeric pages inside the same
  truthful pagination; every Featured row gets one real Standard companion when enough exist;
  the paid span starts only at `lg`; no fixed card heights; never 2×2, `row-span-2`, or
  full-width Featured. Pages that contain Featured results render them under a restrained
  "FEATURED / Paid placement" section register — a presentation boundary over the same page
  data, never a second dataset or an unbounded shelf.
- Missing screenshots render the neutral fallback card — never filter listings by screenshot.
- Production thumbs are 800×500 (16:10); a taller capture variant for wide media columns is an
  approved open follow-up on the API enrichment pipeline.
- 7-day money-back guarantee; no lifetime deals, no free listing tier (free preview is the hook).

## Brand Commitments

Binding (confirmed 2026-08-17): dark-first visual world stays — background #0A0E1A, foreground
#FFFFFF, accent indigo #6366F1 reserved outside tier differentiation, muted #7C8493, hairline
borders rgba(255,255,255,0.08); Geist/Inter with Geist Mono/JetBrains Mono for register lines.
The 2026-08-17 editorial card system is the incumbent language: no pills, tier disclosed in a
bottom ledger register, tonal (never solid-white) bands, no gradients/glow/glassmorphism on
directory cards, no AI-sparkle iconography, no invented metrics. Voice and copy rules live in
the planning repo's BRAND-GUIDELINES.md. Modernization refines this world; it does not replace it.

## Evidence on Hand

504 published listings in production; founding screenshots CDN-backed at
cdn.launchlog.ai/snapshots/*/thumb.webp (202/203 verified 2026-07-27). Real seeded demo data in
`database/seeders` (API repo). No testimonials, case studies, or traffic claims exist yet — do
not fabricate any.

## Product Principles

1. The visitor's trust outranks the sponsor's wallet: paid placement is generous in position,
   honest in disclosure, and never degrades discovery.
2. Machine readability is product, not garnish: every public surface must stay equally true for
   humans, crawlers, and LLMs.
3. Differentiation comes from structure and typography, not decoration: place, scale, and
   register — never borrowed color or fake prestige.
4. The customer's product is the hero: cards exist to show real screenshots and real facts,
   and must degrade gracefully when either is missing.
5. Ship small, verified increments: every visible change is browser-verified against the real
   API before it merges, because merge means deploy.

## Accessibility & Inclusion

WCAG 2.2 AA is a requirement (confirmed 2026-08-17): 4.5:1 body contrast, visible focus,
full keyboard paths. The directory's neutral focus ring on the Featured cell and accent rings
elsewhere are the incumbent pattern.
