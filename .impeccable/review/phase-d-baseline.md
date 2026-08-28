# Phase D baseline — 2026-08-28

Measured against `https://launchlog.ai` before Phase D edits. All routes returned one `h1`.

| Route | Status | Canonical | Robots | JSON-LD blocks | Data source |
|---|---:|---|---|---:|---|
| `/blog` | 200 | `/blog` | index, follow | 2 | WordPress mirror through `/api/blog/posts` |
| representative `/blog/{slug}` | 200 | self | index, follow | 2 | WordPress mirror through `/api/blog/posts/{slug}` |
| `/about` | 200 | `/about` | index, follow | 2 | Nuxt-authored content |
| `/contact` | 200 | `/contact` | noindex, nofollow | 1 | Nuxt form, runtime identity, contact API |
| `/privacy` | 200 | `/privacy` | noindex, nofollow | 1 | Nuxt-authored policy and runtime identity |
| `/terms` | 200 | `/terms` | noindex, nofollow | 1 | Nuxt-authored policy, public plans and runtime tax notice |
| `/cookies` | 200 | `/cookies` | noindex, nofollow | 1 | Nuxt-authored policy |
| `/dmca` | 200 | `/dmca` | noindex, nofollow | 1 | Nuxt-authored policy and runtime mailbox |
| `/help` | 200 | `/help` | noindex, nofollow | 1 | Nuxt-authored support content, public plans and runtime tax notice |
| `/seo-guide` | 200 | `/seo-guide` | index, follow | 2 | Nuxt-authored guide |
| `/api-docs` | 200 | `/api-docs` | noindex, nofollow | 1 | Nuxt-authored API reference |
| `/status` | 200 | `/status` | noindex, nofollow | 1 | Nuxt status route and runtime status URL |

Baseline verification:

- `app/composables/useContact.test.ts`: 5 passed, 0 failed.
- Production build: passed.
- Required SSR suites (`blog`, `private-routes`, `tax-notice`, `listing-proof`): 66 passed, 0 failed.
- Blog failure semantics: upstream failure 503 without deindex; missing post/page 404 with deindex.
- Archive semantics: page-specific canonical, crawlable pagination, continued ItemList positions.
