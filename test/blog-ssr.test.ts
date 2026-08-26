import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// SSR tests run against the real Nitro output, so they need a build. `bun test` skips them when
// .output is absent; CI sets SSR_TESTS=required after the build step so the skip cannot hide.
const serverEntry = fileURLToPath(new URL('../.output/server/index.mjs', import.meta.url))
const isBuilt = existsSync(serverEntry)

if (!isBuilt && process.env.SSR_TESTS === 'required') {
  throw new Error(`SSR_TESTS=required but ${serverEntry} is missing — run "bun run build" first`)
}

const UPSTREAM_PORT = 3197
const SERVER_PORT = 3196
const BASE = `http://127.0.0.1:${SERVER_PORT}`

const CHALLENGE_BODY = '<html><head><title>One moment, please...</title></head><body>checking</body></html>'

const VALID_POST = {
  id: 171,
  date: '2026-08-15T09:00:00',
  modified: '2026-08-15T09:00:00',
  slug: 'a-published-article',
  link: 'https://blog.launchlog.ai/2026/08/15/a-published-article/',
  title: { rendered: 'A Published Article' },
  excerpt: { rendered: '<p>Excerpt.</p>' },
  content: { rendered: '<p>Body.</p>' },
}

// A worst-case upstream payload: astral and double-encoded entities in the title, and a raw
// closing script tag in a field that reaches the JSON-LD without the tag-stripping text cleaner.
// Served only through the slug lookup so the paged corpus and its boundary counts stay untouched.
const HOSTILE_POST = {
  ...VALID_POST,
  id: 173,
  slug: 'a-hostile-article',
  link: 'https://blog.launchlog.ai/2026/08/15/a-hostile-article/',
  title: { rendered: 'Rocket &#x1F680; and &#128640; say &amp;quot;go&amp;quot; when Two &lt; Three' },
  _embedded: { author: [{ name: 'Author </script><script>window.__pwned=1</script>' }] },
}

// 30 posts at 24 per page = one full page, one partial page and an out-of-range third. That is the
// smallest corpus that exercises every pagination boundary, including the one WordPress rejects.
const CORPUS_SIZE = 30
const PER_PAGE = 24

const buildCorpus = (size: number) => [
  VALID_POST,
  ...Array.from({ length: size - 1 }, (_, index) => ({
    ...VALID_POST,
    id: 200 + index,
    slug: `archived-article-${index + 1}`,
    title: { rendered: `Archived Article ${index + 1}` },
  })),
]

// Raised by the long-archive test so the page-number window has a gap to collapse. LaunchLog is at
// 4 pages today and grows past the 5-page window within months, so that branch needs cover now.
let corpusSize = CORPUS_SIZE

type UpstreamMode = 'challenge' | 'empty' | 'posts'

let upstreamMode: UpstreamMode = 'challenge'
let upstream: ReturnType<typeof Bun.serve> | undefined
let server: ReturnType<typeof Bun.spawn> | undefined

function json(body: unknown, total: number): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
      'x-wp-total': String(total),
      'x-wp-totalpages': String(Math.max(1, Math.ceil(total / PER_PAGE))),
    },
  })
}

function canonicalsIn(html: string): string[] {
  return [...html.matchAll(/<link[^>]+rel="canonical"[^>]*>/g)]
    .map(match => match[0].match(/href="([^"]+)"/)?.[1] ?? '')
}

function articleSlugsIn(html: string): string[] {
  return [...new Set([...html.matchAll(/href="\/blog\/([a-z0-9-]+)"/g)].map(match => match[1]!))]
}

function pageLinksIn(html: string): number[] {
  return [...new Set([...html.matchAll(/<a[^>]+href="\/blog\?page=(\d+)"/g)].map(match => Number(match[1])))]
    .sort((a, b) => a - b)
}

function titleIn(html: string): string {
  return html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? ''
}

function metaContentIn(html: string, property: string): string {
  const pattern = new RegExp(`<meta[^>]+(?:property|name)="${property}"[^>]*>`)

  return html.match(pattern)?.[0].match(/content="([^"]*)"/)?.[1] ?? ''
}

function itemListPositionsIn(html: string): number[] {
  const block = html.match(/"@type":"ItemList".*?"itemListElement":\[(.*?)\]/)?.[1] ?? ''

  return [...block.matchAll(/"position":(\d+)/g)].map(match => Number(match[1]))
}

async function waitForServer(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/robots.txt`)
      if (response.ok) return
    }
    catch {
      // not listening yet
    }

    await new Promise(resolve => setTimeout(resolve, 100))
  }

  throw new Error('Nitro server did not become ready in time')
}

describe.skipIf(!isBuilt)('/blog SSR', () => {
  beforeAll(async () => {
    upstream = Bun.serve({
      port: UPSTREAM_PORT,
      fetch(request) {
        if (upstreamMode === 'challenge') {
          // The exact production failure: an anti-bot page served with HTTP 200 text/html.
          return new Response(CHALLENGE_BODY, { headers: { 'content-type': 'text/html' } })
        }

        const query = new URL(request.url).searchParams
        const posts = upstreamMode === 'empty' ? [] : buildCorpus(corpusSize)
        const slug = query.get('slug')

        // Single-post lookup: matched by slug, exactly as WordPress does, and unrelated to paging.
        if (slug !== null) {
          return json([...posts, HOSTILE_POST].filter(post => post.slug === slug), posts.length)
        }

        const perPage = Number(query.get('per_page') ?? PER_PAGE)
        const page = Number(query.get('page') ?? 1)
        const lastPage = posts.length === 0 ? 1 : Math.ceil(posts.length / perPage)

        // WordPress answers 400 for a page past the last one. The archive has to read that as
        // absence, not as the origin being unavailable.
        if (page > lastPage) {
          return new Response(
            JSON.stringify({
              code: 'rest_post_invalid_page_number',
              message: 'The page number requested is larger than the number of pages available.',
              data: { status: 400 },
            }),
            { status: 400, headers: { 'content-type': 'application/json' } },
          )
        }

        return json(posts.slice((page - 1) * perPage, page * perPage), posts.length)
      },
    })

    server = Bun.spawn({
      cmd: ['node', serverEntry],
      env: {
        ...process.env,
        PORT: String(SERVER_PORT),
        NITRO_PORT: String(SERVER_PORT),
        NUXT_PUBLIC_WORDPRESS_BLOG_URL: `http://127.0.0.1:${UPSTREAM_PORT}`,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    await waitForServer()
  })

  afterAll(() => {
    server?.kill()
    upstream?.stop(true)
  })

  describe('behaviour under upstream failure', () => {
    test('an upstream challenge makes /blog answer 503 instead of a false empty state', async () => {
      upstreamMode = 'challenge'

      const response = await fetch(`${BASE}/blog`)
      const body = await response.text()

      expect(response.status).toBe(503)
      expect(body).not.toContain('No articles published yet')
    })

    test('an upstream challenge never marks /blog as indexable-empty', async () => {
      upstreamMode = 'challenge'

      const response = await fetch(`${BASE}/blog`)

      expect(response.status).toBe(503)
      expect(response.headers.get('x-robots-tag')).toBeNull()
    })

    test('a successful empty response is the only way to show the empty state', async () => {
      upstreamMode = 'empty'

      const response = await fetch(`${BASE}/blog`)
      const body = await response.text()

      expect(response.status).toBe(200)
      expect(body).toContain('No articles published yet')
    })

    test('a successful response with posts renders them', async () => {
      upstreamMode = 'posts'

      const response = await fetch(`${BASE}/blog`)
      const body = await response.text()

      expect(response.status).toBe(200)
      expect(body).toContain('/blog/a-published-article')
      expect(body).not.toContain('No articles published yet')
    })

    test('an upstream challenge makes a real post URL answer 503 without a deindex directive', async () => {
      upstreamMode = 'challenge'

      const response = await fetch(`${BASE}/blog/a-published-article`)
      const body = await response.text()

      expect(response.status).toBe(503)
      expect(response.headers.get('x-robots-tag')).toBeNull()
      expect(body).not.toContain('/blog/undefined')
      expect(body).not.toContain('Untitled')
    })

    test('a genuinely missing post still answers 404 with a deindex directive', async () => {
      upstreamMode = 'empty'

      const response = await fetch(`${BASE}/blog/no-such-post`)

      expect(response.status).toBe(404)
      expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    })

    test('the upstream body never reaches a client response', async () => {
      upstreamMode = 'challenge'

      for (const path of ['/blog', '/blog/a-published-article', '/api/blog/posts']) {
        const body = await fetch(`${BASE}${path}`).then(response => response.text())

        expect(body).not.toContain('One moment')
        expect(body).not.toContain('checking')
      }
    })
  })

  describe('hostile upstream text', () => {
    test('entities decode once with real code points and JSON-LD cannot be broken out of', async () => {
      upstreamMode = 'posts'

      const response = await fetch(`${BASE}/blog/a-hostile-article`)
      const body = await response.text()

      expect(response.status).toBe(200)

      // Astral entities decode to the actual emoji, decimal and hex alike.
      expect(body).toContain('Rocket 🚀 and 🚀 say')
      // Double-encoded quotes stay literal after exactly one decoding pass.
      expect(body).toContain('say &amp;quot;go&amp;quot;')
      expect(body).not.toContain('say "go"')

      // The upstream's closing script tag never appears literally anywhere in the response.
      expect(body).not.toContain('window.__pwned=1</script>')

      // EVERY JSON-LD block on the page honours the contract: zero literal `<` in the payload.
      // The lazy capture would keep any stray `<`, so the assertion actually sees it.
      const jsonLdBlocks = [...body.matchAll(/<script[^>]+application\/ld\+json[^>]*>(.*?)<\/script>/gs)]
        .map(match => match[1]!)

      expect(jsonLdBlocks.length).toBeGreaterThanOrEqual(2)

      for (const block of jsonLdBlocks) {
        expect(block).not.toContain('<')
        JSON.parse(block)
      }

      const articleBlock = jsonLdBlocks.find(block => block.includes('BlogPosting')) ?? ''

      expect(articleBlock).toContain('\\u003c/script>')

      // The escaped payload still parses back to the raw upstream string.
      const parsed = JSON.parse(articleBlock) as { author?: { name?: string } }
      expect(parsed.author?.name).toContain('</script>')

      // The breadcrumb block carries the decoded `<` from the title, escaped, and round-trips.
      const breadcrumbBlock = jsonLdBlocks.find(block => block.includes('BreadcrumbList')) ?? ''
      const breadcrumbs = JSON.parse(breadcrumbBlock) as { itemListElement?: Array<{ name?: string }> }

      expect(breadcrumbs.itemListElement?.some(item => item.name?.includes('Two < Three'))).toBe(true)
    })
  })

  describe('archive pagination', () => {
    test('page 1 renders a full page of posts and a crawlable link to page 2', async () => {
      upstreamMode = 'posts'

      const html = await fetch(`${BASE}/blog`).then(response => response.text())

      expect(articleSlugsIn(html)).toHaveLength(PER_PAGE)
      expect(pageLinksIn(html)).toContain(2)
    })

    test('page 2 renders the remaining posts and links back', async () => {
      upstreamMode = 'posts'

      const response = await fetch(`${BASE}/blog?page=2`)
      const html = await response.text()

      expect(response.status).toBe(200)
      expect(articleSlugsIn(html)).toHaveLength(CORPUS_SIZE - PER_PAGE)
      // Page 1 is linked as /blog, never as ?page=1, so the archive has one first-page URL.
      expect(html).toMatch(/<a[^>]+href="\/blog"/)
      expect(pageLinksIn(html)).not.toContain(1)
    })

    // The regression this unit exists for: before pagination, 52 of 76 published posts had no
    // internal link path at all and were reachable only from the sitemap.
    test('every published post is reachable by following archive links alone', async () => {
      upstreamMode = 'posts'

      const seen = new Set<string>()
      const visited = new Set<string>()
      const queue = ['/blog']

      while (queue.length > 0) {
        const path = queue.shift()!
        if (visited.has(path)) continue
        visited.add(path)

        const html = await fetch(`${BASE}${path}`).then(response => response.text())
        articleSlugsIn(html).forEach(slug => seen.add(slug))
        pageLinksIn(html).forEach((page) => {
          const next = page === 1 ? '/blog' : `/blog?page=${page}`
          if (!visited.has(next)) queue.push(next)
        })
      }

      expect(seen.size).toBe(CORPUS_SIZE)
    })

    test('pagination controls are real anchors present in the server-rendered HTML', async () => {
      upstreamMode = 'posts'

      const html = await fetch(`${BASE}/blog`).then(response => response.text())

      expect(html).toMatch(/<a[^>]+href="\/blog\?page=2"/)
    })

    // Vue Router marks a link active on path alone, so every `/blog?page=N` link is "exact active"
    // while on /blog and RouterLink stamps aria-current="page" on all of them. A screen reader
    // would then announce every page in the pagination as the current one.
    test('only the current page is marked aria-current, not every page link', async () => {
      upstreamMode = 'posts'

      const html = await fetch(`${BASE}/blog`).then(response => response.text())
      const nav = html.match(/<nav[^>]+aria-label="Blog archive pagination"[\s\S]*?<\/nav>/)?.[0] ?? ''

      expect(nav).not.toBe('')
      expect([...nav.matchAll(/aria-current="page"/g)]).toHaveLength(1)
    })

    test('page 1 emits exactly one canonical, pointing at /blog', async () => {
      upstreamMode = 'posts'

      const canonicals = canonicalsIn(await fetch(`${BASE}/blog`).then(response => response.text()))

      expect(canonicals).toEqual(['https://launchlog.ai/blog'])
    })

    test('?page=1 canonicalises to /blog rather than to itself', async () => {
      upstreamMode = 'posts'

      const canonicals = canonicalsIn(await fetch(`${BASE}/blog?page=1`).then(response => response.text()))

      expect(canonicals).toEqual(['https://launchlog.ai/blog'])
    })

    // Cross-canonicalising every page to page 1 tells search engines the deeper pages are
    // duplicates, which would undo the crawl path this unit adds.
    test('page 2 self-canonicalises to its own URL', async () => {
      upstreamMode = 'posts'

      const canonicals = canonicalsIn(await fetch(`${BASE}/blog?page=2`).then(response => response.text()))

      expect(canonicals).toEqual(['https://launchlog.ai/blog?page=2'])
    })

    test('a single-language archive does not emit misleading hreflang alternates', async () => {
      upstreamMode = 'posts'

      const html = await fetch(`${BASE}/blog?page=2`).then(response => response.text())
      const alternates = [...html.matchAll(/<link[^>]+rel="alternate"[^>]*>/g)]

      expect(alternates).toEqual([])
    })

    test('page 2 has a differentiated title, og:title and og:url', async () => {
      upstreamMode = 'posts'

      const first = await fetch(`${BASE}/blog`).then(response => response.text())
      const second = await fetch(`${BASE}/blog?page=2`).then(response => response.text())

      expect(titleIn(second)).not.toBe(titleIn(first))
      expect(titleIn(second)).toContain('Page 2')
      expect(metaContentIn(second, 'og:title')).not.toBe(metaContentIn(first, 'og:title'))
      expect(metaContentIn(second, 'og:url')).toBe('https://launchlog.ai/blog?page=2')
    })

    test('ItemList holds only the current page and continues its positions', async () => {
      upstreamMode = 'posts'

      const first = itemListPositionsIn(await fetch(`${BASE}/blog`).then(response => response.text()))
      const second = itemListPositionsIn(await fetch(`${BASE}/blog?page=2`).then(response => response.text()))

      expect(first).toEqual(Array.from({ length: PER_PAGE }, (_, index) => index + 1))
      expect(second).toEqual(
        Array.from({ length: CORPUS_SIZE - PER_PAGE }, (_, index) => PER_PAGE + index + 1),
      )
    })

    test('a long archive collapses the middle and still links the first and last pages', async () => {
      upstreamMode = 'posts'
      corpusSize = 240 // 10 pages

      try {
        const html = await fetch(`${BASE}/blog?page=5`).then(response => response.text())
        const nav = html.match(/<nav[^>]+aria-label="Blog archive pagination"[\s\S]*?<\/nav>/)?.[0] ?? ''

        expect(nav).toContain('…')
        expect(pageLinksIn(html)).toContain(10)
        expect(html).toMatch(/<a[^>]+href="\/blog"/)
        expect([...nav.matchAll(/aria-current="page"/g)]).toHaveLength(1)
      }
      finally {
        corpusSize = CORPUS_SIZE
      }
    })

    test('a page past the last one is 404 with a deindex directive, not an empty 200', async () => {
      upstreamMode = 'posts'

      const response = await fetch(`${BASE}/blog?page=3`)
      const html = await response.text()

      expect(response.status).toBe(404)
      expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
      expect(html).not.toContain('No articles published yet')
    })

    test('a malformed page parameter is 404 with a deindex directive', async () => {
      upstreamMode = 'posts'

      for (const value of ['abc', '0', '-1', '1.5', '']) {
        const response = await fetch(`${BASE}/blog?page=${value}`)

        expect(response.status).toBe(404)
        expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
      }
    })

    // Absence and unavailability must not collapse into each other on the paged route either.
    test('an upstream failure on a deeper page is still 503, never 404', async () => {
      upstreamMode = 'challenge'

      const response = await fetch(`${BASE}/blog?page=2`)
      const html = await response.text()

      expect(response.status).toBe(503)
      expect(response.headers.get('x-robots-tag')).toBeNull()
      expect(html).not.toContain('Untitled')
      expect(html).not.toContain('/blog/undefined')
    })

    // Client-side navigation re-runs only the API request, so the endpoint alone decides whether the
    // archive shows 404 or 503 after a click. These lock that contract independently of the page.
    test('the api route answers 503 for a deeper page when the upstream fails', async () => {
      upstreamMode = 'challenge'

      const response = await fetch(`${BASE}/api/blog/posts?page=2`)

      expect(response.status).toBe(503)
      expect(await response.text()).not.toContain('checking')
    })

    test('the api route answers 404 for a page past the last one', async () => {
      upstreamMode = 'posts'

      expect((await fetch(`${BASE}/api/blog/posts?page=3`)).status).toBe(404)
      expect((await fetch(`${BASE}/api/blog/posts?page=99`)).status).toBe(404)
    })

    // A zero-padded page renders identical posts under a second URL.
    test('a zero-padded page alias is 404 with a deindex directive', async () => {
      upstreamMode = 'posts'

      for (const value of ['01', '0002', '001']) {
        const response = await fetch(`${BASE}/blog?page=${value}`)

        expect(response.status).toBe(404)
        expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
      }

      expect((await fetch(`${BASE}/api/blog/posts?page=01`)).status).toBe(404)
    })

    test('an unsafe integer page is rejected without reaching WordPress', async () => {
      upstreamMode = 'posts'

      for (const value of [String(Number.MAX_SAFE_INTEGER + 1), '9'.repeat(50)]) {
        const response = await fetch(`${BASE}/blog?page=${value}`)

        expect(response.status).toBe(404)
        expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
      }
    })

    test('the api route reports pagination meta alongside the posts', async () => {
      upstreamMode = 'posts'

      const body = await fetch(`${BASE}/api/blog/posts?page=2`).then(response => response.json()) as {
        posts: unknown[]
        meta: Record<string, number>
      }

      expect(body.meta).toEqual({
        current_page: 2,
        last_page: 2,
        per_page: PER_PAGE,
        total: CORPUS_SIZE,
      })
      expect(body.posts).toHaveLength(CORPUS_SIZE - PER_PAGE)
    })
  })
})
