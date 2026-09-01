import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const serverEntry = fileURLToPath(new URL('../.output/server/index.mjs', import.meta.url))
const nitroChunk = fileURLToPath(new URL('../.output/server/chunks/nitro/nitro.mjs', import.meta.url))
const isBuilt = existsSync(serverEntry)

if (!isBuilt && process.env.SSR_TESTS === 'required') {
  throw new Error(`SSR_TESTS=required but ${serverEntry} is missing — run "bun run build" first`)
}

const UPSTREAM_PORT = 3311
const SERVER_PORT = 3310
const BASE = `http://127.0.0.1:${SERVER_PORT}`

const summary = (slug: string, itemCount: number, index = 0) => ({
  slug,
  week_starts_at: new Date(Date.UTC(2026, 7, 24 - (index * 7))).toISOString().slice(0, 10),
  week_ends_at: new Date(Date.UTC(2026, 7, 30 - (index * 7))).toISOString().slice(0, 10),
  introduction: `The durable release record for ${slug}.`,
  published_at: new Date(Date.UTC(2026, 7, 31 - (index * 7))).toISOString(),
  modified_at: new Date(Date.UTC(2026, 7, 31 - (index * 7), 0, 5)).toISOString(),
  item_count: itemCount,
  path: `/shipped/${slug}`,
})

const editionSlug = (index: number): string => index < 35
  ? `2026-w${String(35 - index).padStart(2, '0')}`
  : `2025-w${String(88 - index).padStart(2, '0')}`

const editionSummaries = (count: number) => Array.from(
  { length: count },
  (_, index) => summary(editionSlug(index), index === 0 ? 3 : 1, index),
)

const CURRENT_PATH = '/listing/current-launch'
const CARRIED_PATH = '/listing/carried-launch'
const WITHDRAWN_NAME = 'Withdrawn </script><script>window.__edition_pwned=1</script>'
const PAGE_TWO_SLUG = editionSlug(24)
const PUBLIC_CACHE = 'public, max-age=0, s-maxage=600, stale-while-revalidate=600'

const detail = {
  ...summary('2026-w35', 3),
  items: [
    {
      kind: 'new_listing',
      position: 1,
      shipped_at: '2026-08-27',
      source_week_starts_at: null,
      carried_over: false,
      name: 'Current Launch',
      tagline: 'A current public listing.',
      tier_label: 'Standard',
      image_url: null,
      current: true,
      listing_path: CURRENT_PATH,
      provenance_url: 'https://current.example/release',
      include_in_item_list: true,
    },
    {
      kind: 'new_listing',
      position: 2,
      shipped_at: '2026-08-28',
      source_week_starts_at: '2026-08-17',
      carried_over: true,
      name: 'Carried Launch',
      tagline: 'Reported after the prior cutoff.',
      tier_label: 'Featured',
      image_url: null,
      current: true,
      listing_path: CARRIED_PATH,
      provenance_url: null,
      include_in_item_list: true,
    },
    {
      kind: 'new_listing',
      position: 3,
      shipped_at: '2026-08-29',
      source_week_starts_at: null,
      carried_over: false,
      name: WITHDRAWN_NAME,
      tagline: 'Frozen historical copy.',
      tier_label: 'Standard',
      image_url: null,
      current: false,
      listing_path: null,
      provenance_url: null,
      include_in_item_list: false,
    },
  ],
}

const listing = (slug: string, tier: 'basic' | 'featured') => ({
  slug,
  name: `Product ${slug}`,
  tagline: 'A public listing that remains independent from weekly editions.',
  url: `https://${slug}.example`,
  screenshot_url: null,
  tier,
  source: 'seed',
  category: null,
  tags: [],
  tech_stack: [],
  has_llms_txt: true,
  has_schema_org: true,
  has_markdown_negotiation: true,
  country: null,
  published_at: '2026-08-30T00:00:00+00:00',
})

const discoveryListing = (slug: string) => ({
  slug,
  name: `Discovery ${slug}`,
  tagline: 'A production-shaped discovery record.',
  updated_at: '2026-08-30T00:00:00+00:00',
})

const wordpressPost = (slug: string) => ({
  id: 1,
  date: '2026-08-30T00:00:00',
  modified: '2026-08-30T00:00:00',
  slug,
  link: `http://127.0.0.1:${UPSTREAM_PORT}/blog/${slug}`,
  title: { rendered: `Blog ${slug}` },
  excerpt: { rendered: `Excerpt for ${slug}` },
  featured_media: 0,
})

type UpstreamMode = 'ok' | 'editions-503' | 'listings-503'

let mode: UpstreamMode = 'ok'
let editionFixtureCount = 25
let upstream: ReturnType<typeof Bun.serve> | undefined
let server: ReturnType<typeof Bun.spawn> | undefined

async function waitForServer(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE}/robots.txt`)).ok) return
    }
    catch {
      // The exact Nitro process has not started listening yet.
    }
    await Bun.sleep(200)
  }
  throw new Error(`SSR server did not become ready on ${BASE}`)
}

function spawnNitro(): ReturnType<typeof Bun.spawn> {
  return Bun.spawn({
    cmd: ['node', serverEntry],
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      NITRO_PORT: String(SERVER_PORT),
      NUXT_PUBLIC_API_URL: `http://127.0.0.1:${UPSTREAM_PORT}`,
      NUXT_PUBLIC_WORDPRESS_BLOG_URL: `http://127.0.0.1:${UPSTREAM_PORT}`,
      NUXT_PUBLIC_DOMAIN: 'launchlog.ai',
    },
    stdout: 'ignore',
    stderr: 'ignore',
  })
}

async function restartNitro(): Promise<void> {
  server?.kill()
  await server?.exited
  server = spawnNitro()
  await waitForServer()
}

function canonicalIn(html: string): string {
  const tag = html.match(/<link[^>]+rel="canonical"[^>]*>/)?.[0] ?? ''
  return tag.match(/href="([^"]+)"/)?.[1] ?? ''
}

function jsonLdFrom(html: string): unknown[] {
  return [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1]!))
}

function visibleHtmlFrom(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
}

describe.skipIf(!isBuilt)('/shipped SSR', () => {
  beforeAll(async () => {
    upstream = Bun.serve({
      port: UPSTREAM_PORT,
      fetch(request) {
        const url = new URL(request.url)

        if (url.pathname === '/api/v1/listings') {
          if (mode === 'listings-503') {
            return Response.json({ message: 'directory unavailable' }, { status: 503 })
          }
          const records = url.searchParams.get('tier') === 'featured'
            ? [listing('featured-one', 'featured')]
            : [listing('latest-one', 'basic'), listing('featured-one', 'featured')]
          return Response.json({
            data: records,
            meta: {
              current_page: 1,
              last_page: 1,
              per_page: records.length,
              total: records.length,
            },
          })
        }

        if (url.pathname === '/api/v1/discovery/listings') {
          return Response.json({ data: [discoveryListing('seeded')] })
        }

        if (url.pathname === '/wp-json/wp/v2/posts') {
          return Response.json([wordpressPost('seeded-article')], {
            headers: { 'x-wp-total': '1', 'x-wp-totalpages': '1' },
          })
        }

        if (url.pathname === '/wp-json/wp/v2/media') {
          return Response.json([])
        }

        if (url.pathname === '/api/v1/discovery/editions') {
          if (mode === 'editions-503') {
            return Response.json({ message: 'edition source unavailable' }, { status: 503 })
          }
          const page = Number(url.searchParams.get('page') ?? 1)
          const rows = editionSummaries(editionFixtureCount)
          const lastPage = Math.max(1, Math.ceil(rows.length / 24))
          if (page >= 1 && page <= lastPage) {
            return Response.json({
              data: rows.slice((page - 1) * 24, page * 24),
              meta: { current_page: page, last_page: lastPage, per_page: 24, total: rows.length },
            })
          }
          return Response.json({ message: 'Edition page not found' }, { status: 404 })
        }

        const match = url.pathname.match(/^\/api\/v1\/discovery\/editions\/([^/]+)$/)
        if (match) {
          if (mode === 'editions-503') {
            return Response.json({ message: 'edition source unavailable' }, { status: 503 })
          }
          if (match[1] === '2026-w35') return Response.json({ data: detail })
          return Response.json({ message: 'Edition not found' }, { status: 404 })
        }

        return new Response('not found', { status: 404 })
      },
    })
    server = spawnNitro()
    await waitForServer()
  })

  beforeEach(() => {
    mode = 'ok'
    editionFixtureCount = 25
  })

  afterAll(async () => {
    server?.kill()
    await server?.exited
    await upstream?.stop(true)
  })

  test('renders page one and page two with self canonicals and real pagination anchors', async () => {
    const first = await fetch(`${BASE}/shipped`)
    const firstHtml = await first.text()
    expect(first.status).toBe(200)
    expect(firstHtml).toContain('2026-w35')
    expect(firstHtml).toContain('href="/shipped/2026-w35"')
    expect(firstHtml).toContain('href="/shipped?page=2"')
    expect(firstHtml).toContain('rel="next"')
    expect(canonicalIn(firstHtml)).toBe('https://launchlog.ai/shipped')

    const second = await fetch(`${BASE}/shipped?page=2`)
    const secondHtml = await second.text()
    expect(second.status).toBe(200)
    expect(secondHtml).toContain(PAGE_TWO_SLUG)
    expect(secondHtml).toContain('href="/shipped"')
    expect(secondHtml).toContain('rel="prev"')
    expect(canonicalIn(secondHtml)).toBe('https://launchlog.ai/shipped?page=2')
  })

  test.each(['0', '-1', '1.2', '01', 'no', '9999999999'])(
    'rejects invalid archive page %s with 404',
    async (page) => {
      expect((await fetch(`${BASE}/shipped?page=${encodeURIComponent(page)}`)).status).toBe(404)
    },
  )

  test('maps a real upstream overflow and an unknown edition to 404', async () => {
    expect((await fetch(`${BASE}/shipped?page=3`)).status).toBe(404)
    expect((await fetch(`${BASE}/shipped/2026-w34`)).status).toBe(404)
    expect((await fetch(`${BASE}/shipped/draft`)).status).toBe(404)
  })

  test('renders current, carried and withdrawn evidence without reviving withdrawn links', async () => {
    const response = await fetch(`${BASE}/shipped/2026-w35`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(canonicalIn(html)).toBe('https://launchlog.ai/shipped/2026-w35')
    expect(html).toContain(`href="${CURRENT_PATH}"`)
    expect(html).toContain(`href="${CARRIED_PATH}"`)
    const currentAnchor = html.match(new RegExp(`<a[^>]+href="${CURRENT_PATH}"[^>]*>`))?.[0] ?? ''
    expect(currentAnchor).toContain('rel="noopener sponsored"')

    const proofAnchor = html.match(/<a[^>]+href="https:\/\/current\.example\/release"[^>]*>/)?.[0] ?? ''
    expect(proofAnchor).toContain('rel="noopener"')
    expect(proofAnchor).not.toContain('noreferrer')
    expect(proofAnchor).not.toContain('sponsored')
    expect(html).toContain('Reported after cutoff')
    expect(html).toContain('No longer active')
    expect(html).not.toContain('/listing/withdrawn')
    expect(html).not.toContain('withdrawn.example')
    expect(html).not.toContain('window.__edition_pwned=1</script>')

    const graphs = jsonLdFrom(html)
    const serialized = JSON.stringify(graphs)
    expect(serialized).toContain('Current Launch')
    expect(serialized).toContain('Carried Launch')
    expect(serialized).not.toContain(WITHDRAWN_NAME)
    expect(serialized).not.toContain('/listing/withdrawn')
    expect(html).toContain('/submit?source=edition&amp;edition_slug=2026-w35')
  })

  test('keeps HTML and page-aware Markdown representations isolated by Accept', async () => {
    await restartNitro()

    const firstHtml = await fetch(`${BASE}/shipped`)
    const firstHtmlBody = await firstHtml.text()
    expect(firstHtml.status).toBe(200)
    expect(firstHtml.headers.get('content-type')).toContain('text/html')
    expect(firstHtml.headers.get('vary')).toMatch(/(?:^|,\s*)Accept(?:,|$)/i)
    expect(firstHtmlBody).toContain('href="/shipped/2026-w35"')

    const firstMarkdown = await fetch(`${BASE}/shipped`, {
      headers: { Accept: 'text/markdown' },
    })
    const firstMarkdownBody = await firstMarkdown.text()
    expect(firstMarkdown.status).toBe(200)
    expect(firstMarkdown.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(firstMarkdown.headers.get('cache-control')).toBe(PUBLIC_CACHE)
    expect(firstMarkdown.headers.get('vary')).toMatch(/(?:^|,\s*)Accept(?:,|$)/i)
    expect(firstMarkdownBody).toContain('# LaunchLog shipped — page 1')
    expect(firstMarkdownBody).toContain('2026-w35')
    expect(firstMarkdownBody).not.toContain(PAGE_TWO_SLUG)

    const secondMarkdown = await fetch(`${BASE}/shipped?page=2`, {
      headers: { Accept: 'text/markdown' },
    })
    const secondMarkdownBody = await secondMarkdown.text()
    expect(secondMarkdown.status).toBe(200)
    expect(secondMarkdown.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(secondMarkdown.headers.get('cache-control')).toBe(PUBLIC_CACHE)
    expect(secondMarkdownBody).toContain('# LaunchLog shipped — page 2')
    expect(secondMarkdownBody).toContain(PAGE_TWO_SLUG)
    expect(secondMarkdownBody).not.toContain('2026-w35')

    const htmlAgain = await fetch(`${BASE}/shipped`)
    const htmlAgainBody = await htmlAgain.text()
    expect(htmlAgain.headers.get('content-type')).toContain('text/html')
    expect(htmlAgainBody).toBe(firstHtmlBody)
    expect(htmlAgainBody).not.toContain('# LaunchLog shipped — page 1')
  })

  test('matches HTML archive errors with safe private Markdown receipts', async () => {
    for (const path of ['/shipped?page=0', '/shipped?page=3']) {
      const html = await fetch(`${BASE}${path}`)
      const markdown = await fetch(`${BASE}${path}`, { headers: { Accept: 'text/markdown' } })

      expect(html.status).toBe(404)
      expect(markdown.status).toBe(html.status)
      expect(markdown.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
      expect(markdown.headers.get('cache-control')).toBe('private, no-store')
      expect(markdown.headers.get('vary')).toMatch(/(?:^|,\s*)Accept(?:,|$)/i)
      expect(await markdown.text()).toBe('# Not found\n')
    }
  })

  test('matches current, carried and withdrawn evidence across HTML, JSON-LD and Markdown', async () => {
    const html = await fetch(`${BASE}/shipped/2026-w35`).then(response => response.text())
    const visibleHtml = visibleHtmlFrom(html)
    const markdownResponse = await fetch(`${BASE}/shipped/2026-w35`, {
      headers: { Accept: 'text/markdown' },
    })
    const markdown = await markdownResponse.text()
    const graphs = jsonLdFrom(html) as Array<{ '@graph'?: Array<Record<string, unknown>> }>
    const itemList = graphs
      .flatMap(graph => graph['@graph'] ?? [])
      .find(node => node['@type'] === 'ItemList')

    expect(markdownResponse.status).toBe(200)
    expect(markdownResponse.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(markdownResponse.headers.get('cache-control')).toBe(PUBLIC_CACHE)
    expect(markdown).toContain(String.raw`Published: 2026\-08\-31T00:00:00.000Z`)
    expect(markdown).toContain('## 1\\. Current Launch')
    expect(markdown).toContain('## 2\\. Carried Launch')
    expect(markdown).toContain('Reported after cutoff')
    expect(markdown).toContain('## 3\\. Withdrawn &lt;/script&gt;')
    expect(markdown).toContain('No longer active')
    expect(markdown).toContain(`href="https://launchlog.ai${CURRENT_PATH}" rel="noopener sponsored"`)
    expect(markdown).toContain('href="https://current.example/release" rel="noopener"')
    expect(visibleHtml).toContain('2026-08-24')
    expect(visibleHtml).toContain('2026-08-30')
    expect(visibleHtml).toContain('31 Aug 2026')
    expect(visibleHtml).toContain('2026-08-27')
    expect(visibleHtml).toContain('2026-08-28')
    expect(visibleHtml).toContain('2026-08-29')
    expect(visibleHtml.indexOf('Current Launch')).toBeLessThan(visibleHtml.indexOf('Carried Launch'))
    expect(visibleHtml.indexOf('Carried Launch')).toBeLessThan(visibleHtml.indexOf('Withdrawn'))
    expect(itemList?.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Current Launch',
        url: `https://launchlog.ai${CURRENT_PATH}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Carried Launch',
        url: `https://launchlog.ai${CARRIED_PATH}`,
      },
    ])
    expect(markdown.indexOf('Current Launch')).toBeLessThan(markdown.indexOf('Carried Launch'))
    expect(markdown.indexOf('Carried Launch')).toBeLessThan(markdown.indexOf('Withdrawn'))
  })

  test('publishes every edition canonical once in sitemap and maps the archive in llms.txt', async () => {
    await restartNitro()

    const sitemap = await fetch(`${BASE}/sitemap.xml`)
    const sitemapBody = await sitemap.text()
    expect(sitemap.status).toBe(200)
    expect(sitemap.headers.get('cache-control')).toBe(PUBLIC_CACHE)
    expect(sitemapBody.match(/<loc>https:\/\/launchlog\.ai\/shipped<\/loc>/g) ?? []).toHaveLength(1)
    expect(sitemapBody.match(/<loc>https:\/\/launchlog\.ai\/shipped\?page=2<\/loc>/g) ?? [])
      .toHaveLength(1)
    for (const edition of editionSummaries(25)) {
      expect(sitemapBody.match(new RegExp(`<loc>https://launchlog\\.ai${edition.path}</loc>`, 'g')) ?? [])
        .toHaveLength(1)
      const sitemapLastmod = edition.modified_at.replace(/\.000Z$/, 'Z')
      expect(sitemapBody).toContain(`<lastmod>${sitemapLastmod}</lastmod>`)
    }
    expect(sitemapBody).not.toContain('/shipped/2026-w36')

    const llms = await fetch(`${BASE}/llms.txt`)
    expect(llms.status).toBe(200)
    expect(await llms.text()).toContain('https://launchlog.ai/shipped')
  })

  test.each([51, 52, 53])('caps llms-full at 52 of %i published editions', async (count) => {
    editionFixtureCount = count
    const response = await fetch(`${BASE}/llms-full.txt`)
    const body = await response.text()
    const editionSection = body.split('## Published weekly editions')[1]?.split('## Published blog articles')[0] ?? ''
    const renderedSlugs = [...editionSection.matchAll(/^- (\d{4}-w\d{2})\b/gm)]
      .map(match => match[1])

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe(PUBLIC_CACHE)
    expect(renderedSlugs).toEqual(editionSummaries(count).slice(0, 52).map(edition => edition.slug))
    expect(body.includes('More published editions are available in the sitemap:')).toBe(count > 52)
    expect(body.includes('https://launchlog.ai/sitemap.xml')).toBe(count > 52)
    expect(body).not.toContain('/shipped/2026-w36')
  })

  test('keeps llms-full atomic when edition discovery is unavailable', async () => {
    mode = 'editions-503'
    await restartNitro()

    const response = await fetch(`${BASE}/llms-full.txt`)
    const body = await response.text()
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body).toBe('# LaunchLog — temporarily unavailable\n')
    expect(body).not.toContain('## Published listings')
    expect(body).not.toContain('## Published weekly editions')
    expect(body).not.toContain('## Published blog articles')
  })

  test('answers a styled 503 when the edition source is unavailable', async () => {
    mode = 'editions-503'
    await restartNitro()

    for (const path of ['/shipped', '/shipped/2026-w35']) {
      const response = await fetch(`${BASE}${path}`)
      const html = await response.text()
      expect(response.status).toBe(503)
      expect(html).toContain('temporarily unavailable')
      expect(html).toContain('border-release-seam')
      expect(html).not.toContain('edition source unavailable')
    }
  })

  test('keeps the latest edition visible when homepage listings fail', async () => {
    mode = 'listings-503'
    await restartNitro()

    const response = await fetch(BASE)
    const html = await response.text()
    expect(response.status).toBe(200)
    expect(html).toContain('Listings are temporarily unavailable')
    expect(html).toContain('Latest weekly edition')
    expect(html).toContain('href="/shipped/2026-w35"')
  })

  test('keeps homepage listing inventory visible when the latest edition fails', async () => {
    mode = 'editions-503'
    await restartNitro()

    const response = await fetch(BASE)
    const html = await response.text()
    expect(response.status).toBe(200)
    expect(html).toContain('Latest release')
    expect(html).toContain('Product latest-one')
    expect(html).not.toContain('Latest weekly edition')
    expect(html).not.toContain('temporarily unavailable')
  })

  test('emits one main landmark on each public edition surface', async () => {
    for (const path of ['/shipped', '/shipped/2026-w35']) {
      const html = await fetch(`${BASE}${path}`).then(response => response.text())
      expect(html.match(/<main(?:\s|>)/g) ?? []).toHaveLength(1)
    }
  })

  test('builds exact per-instance SWR rules for archive and detail', () => {
    const output = readFileSync(nitroChunk, 'utf8')
    // Nitro expands `swr: 600` with its normalized `cache` object in the
    // production bundle. Pin the public rule and value without rejecting that
    // framework-owned representation.
    expect(output).toMatch(/"\/shipped":\s*\{[^}]*"swr":\s*600/)
    expect(output).toMatch(/"\/shipped\/\*\*":\s*\{[^}]*"swr":\s*600/)
  })
})
