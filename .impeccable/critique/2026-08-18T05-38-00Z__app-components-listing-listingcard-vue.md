---
target: Featured 2x1 and Standard 1x1 directory cards
total_score: 23
max_score: 28
na_heuristics: 7,9,10
p0_count: 0
p1_count: 3
timestamp: 2026-08-18T05-38-00Z
slug: app-components-listing-listingcard-vue
---
Method: dual-agent (A: featured_design_assessment · B: featured_detector_assessment)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 4 | Featured tier is immediately recognizable. |
| 2 | Match system / real world | 2 | Featured-only “Paid placement” creates a false paid-versus-organic binary. |
| 3 | User control and freedom | 4 | Cards retain clear navigation and focus behavior. |
| 4 | Consistency and standards | 3 | The declared mono family is not loaded; the live UI falls back to Menlo. |
| 5 | Error prevention | 3 | Copy can make visitors misinterpret the commercial model. |
| 6 | Recognition rather than recall | 4 | Tier, category, and domain are structurally discoverable. |
| 7 | Flexibility and efficiency | n/a | Not material to this card-level browse critique. |
| 8 | Aesthetic and minimalist design | 3 | Strong authored composition, but footer contrast and repeated tier wording weaken it. |
| 9 | Error recovery | n/a | No error-recovery interaction exists in this target. |
| 10 | Help and documentation | n/a | Not applicable to a directory card. |
| **Total** | | **23/28** | **Strong visual system, semantic and accessibility correction required.** |

## Design Specificity Verdict

The result is distinctly LaunchLog: screenshot-led cards, neutral tier differentiation, ledger registers, and mono provenance feel authored for “the log of what shipped.” The deterministic detector returned zero pattern findings, but live axe and raster measurements found one real accessibility failure the source-only detector missed.

## What’s Working

- Featured differentiation comes from footprint, frame, typography, and structure rather than indigo, gradients, or prestige decoration.
- Standard remains a credible paid product, not a deliberately weakened decoy.
- Category and domain provenance support visitor trust with factual metadata.

## Priority Issues

### [P1] Featured-only “Paid placement” is semantically wrong

Every customer plan is paid, while production also contains manually seeded Founding entries. The card should name the incremental Featured benefit, not make a claim about payment status. Replace it with **“Priority placement”**. Do not add “all listings are paid” to the directory because Founding inventory makes that statement literally false.

Suggested command: `$impeccable clarify`.

### [P1] Featured footer fails WCAG 2.2 AA

`#7C8493` over the composited Featured band measures approximately **3.69:1** at 11px. Six live nodes fail: three domains and three descriptors. Standard measures approximately **4.93:1**, passing but remaining visually weak at 11px. Raise both registers to 12px/20px; use a brighter neutral such as `text-brand-fg/70` for Featured metadata and descriptor, while Standard can retain its quieter hierarchy or move to `text-brand-fg/60` for a safer margin.

Suggested command: `$impeccable audit`.

### [P1] The section heading visually scopes over Standard companions

“Featured launches” spans a grid containing one real Standard companion per Featured row. On mobile, where the row relationship disappears, that Standard card can read as another Featured result. Preserve the section boundary at desktop, but hide or reframe the section register below `lg`, allowing each card’s own register to state its tier truth.

Suggested command: `$impeccable clarify` and `$impeccable adapt`.

### [P2] Footer wrapping and font choice are accidental

At 390px the right descriptor wraps into an accidental second row. Use an intentional stacked mobile / two-column desktop register rather than `flex-wrap`. The declared Geist Mono/JetBrains Mono is not loaded; production resolves to Menlo. Load Geist Mono if it is the committed register face, or document Menlo/system mono as intentional.

Suggested command: `$impeccable typeset` and `$impeccable adapt`.

## Persona Red Flags

- **Visitor scanning products:** can incorrectly infer Standard companions are organic/free and Featured is the only paid inventory.
- **Standard buyer:** sees a credible card, but the Featured-only payment label makes their own paid plan appear commercially ambiguous.
- **Low-vision visitor:** cannot reliably read Featured category/domain or the right-hand descriptor at the current contrast and size.

## Recommended Copy System

1. Section register: **Featured launches** (desktop only if the companion relationship cannot remain clear on mobile).
2. Featured footer left: **FEATURED · category · domain**.
3. Featured footer right: **Priority placement**.
4. Standard footer: category · domain, with no “paid/unpaid” language and no forced prestige label.
5. Pricing/help truth: **No free customer listing plan. Featured adds priority placement.** This belongs in commercial explanation, not repeated on every directory card.

## Questions to Consider

- Can the card explain the purchased benefit without explaining the entire business model? Yes: “Priority placement.”
- Can Standard remain quiet without becoming ambiguous? Yes: preserve the same factual register, improve readability, and avoid payment labels on either tier.
