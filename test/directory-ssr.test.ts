import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Regression guard for a real production defect: ListingGrid passed 'NuxtLink' to
// <component :is> as a STRING. Vue does not resolve a globally-registered component
// from a string there, so it emitted a literal <NuxtLink> custom element and every
// directory card rendered with no <a href> at all — no navigation, and no internal
// links in the SSR HTML. Lint, typecheck, build and the unit suite all passed.
// Only rendered output catches it, so this test asserts on rendered output.
const serverEntry = fileURLToPath(new URL('../.output/server/index.mjs', import.meta.url))
const isBuilt = existsSync(serverEntry)

if (!isBuilt && process.env.SSR_TESTS === 'required') {
  throw new Error(`SSR_TESTS=required but ${serverEntry} is missing — run "bun run build" first`)
}

const UPSTREAM_PORT = 3199
const SERVER_PORT = 3198
const BASE = `http://127.0.0.1:${SERVER_PORT}`
const preload = fileURLToPath(new URL('./helpers/fake-clock-preload.mjs', import.meta.url))

const card = (slug: string, tier: 'basic' | 'featured') => ({
  slug,
  name: `Product ${slug}`,
  tagline: 'A one-line pitch.',
  url: `https://${slug}.example.com`,
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
  published_at: '2026-08-01T00:00:00Z',
})

// A production-shaped slot-aware page: 2 Featured (4 slots) + 26 Standard (26)
// spends exactly the 30 visual slots a directory page owns. Mirrors the API's
// tier-major ordering: featured, then basic.
const LISTINGS = [
  card('one-featured', 'featured'),
  card('two-featured', 'featured'),
  ...Array.from({ length: 26 }, (_, index) =>
    card(`basic-${String(index + 1).padStart(2, '0')}`, 'basic')),
]

const DIRECTORY_META = {
  current_page: 1,
  from: 1,
  last_page: 1,
  per_page: LISTINGS.length,
  to: LISTINGS.length,
  total: LISTINGS.length,
  slot_capacity: 30,
  slots_used: 30,
}

const discoveryListing = (slug: string) => ({
  slug,
  name: `Discovery ${slug}`,
  tagline: 'A production-shaped discovery record.',
  updated_at: '2026-08-26T10:00:00.000000Z',
})

const wordpressPost = (slug: string) => ({
  id: 1,
  date: '2026-08-26T10:00:00',
  modified: '2026-08-26T10:00:00',
  slug,
  link: `http://127.0.0.1:${UPSTREAM_PORT}/blog/${slug}`,
  title: { rendered: `Blog ${slug}` },
  excerpt: { rendered: `Excerpt for ${slug}` },
})

type UpstreamState = {
  status: number
  body?: unknown
}

const defaultUpstreamState = () => ({
  listings: {
    status: 200,
    body: { data: [discoveryListing('seeded')] },
  } satisfies UpstreamState,
  directory: { status: 200 } satisfies UpstreamState,
  wordpress: {
    status: 200,
    body: [wordpressPost('seeded-article')],
  } satisfies UpstreamState,
})

let upstreamState = defaultUpstreamState()

const seededDirectoryState = (): UpstreamState => ({
  status: 200,
  body: {
    data: LISTINGS,
    meta: { ...DIRECTORY_META, last_page: 2, to: LISTINGS.length, total: LISTINGS.length * 2 },
  },
})

/** Every upstream URL the SSR render asked for, so tests can assert the request. */
const upstreamRequests: string[] = []
const listingDiscoveryResponseStatuses: number[] = []

let upstream: ReturnType<typeof Bun.serve> | undefined
let server: ReturnType<typeof Bun.spawn> | undefined
let clockDir = ''
let clockFile = ''

async function waitForServer(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/robots.txt`)
      if (response.ok) return
    }
    catch {
      // server not up yet
    }
    await Bun.sleep(250)
  }

  throw new Error(`SSR server did not become ready on ${BASE}`)
}

function spawnNitro(): ReturnType<typeof Bun.spawn> {
  if (!clockFile) throw new Error('Fixture clock has not been initialized')

  return Bun.spawn({
    cmd: ['node', serverEntry],
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      NUXT_PUBLIC_API_URL: `http://127.0.0.1:${UPSTREAM_PORT}`,
      NUXT_PUBLIC_WORDPRESS_BLOG_URL: `http://127.0.0.1:${UPSTREAM_PORT}`,
      LAUNCHLOG_TEST_CLOCK_FILE: clockFile,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${preload}`].filter(Boolean).join(' '),
    },
    stdout: 'ignore',
    stderr: 'ignore',
  })
}

async function restartNitroInstance(): Promise<void> {
  server?.kill()
  await server?.exited
  server = spawnNitro()
  await waitForServer()
}

function advanceFixtureClockBy(seconds: number): void {
  if (!clockFile) throw new Error('Fixture clock has not been initialized')

  writeFileSync(clockFile, String(seconds * 1000))
}

async function waitForBody(url: string, text: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const body = await fetch(url).then(response => response.text())
    if (body.includes(text)) return
    await Bun.sleep(100)
  }

  throw new Error(`Timed out waiting for ${text}`)
}

async function waitForListingDiscoveryResponse(
  status: number,
  startIndex: number,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (listingDiscoveryResponseStatuses.slice(startIndex).includes(status)) {
      // The local upstream has returned the status to Nitro; yield once before
      // moving to recovery so the background refresh can finish its error path.
      await Bun.sleep(0)
      return
    }
    await Bun.sleep(25)
  }

  throw new Error(`Timed out waiting for listing discovery response ${status}`)
}

describe.skipIf(!isBuilt)('directory SSR renders real anchors', () => {
  beforeAll(async () => {
    // These files exist only while the built suite is actually running. A skipped
    // pre-build import must not leak a temp directory into a developer checkout.
    clockDir = mkdtempSync(join(tmpdir(), 'launchlog-swr-clock-'))
    clockFile = join(clockDir, 'offset-ms')
    writeFileSync(clockFile, '0')

    upstream = Bun.serve({
      port: UPSTREAM_PORT,
      fetch(request) {
        upstreamRequests.push(request.url)

        const url = new URL(request.url)

        if (url.pathname === '/api/v1/discovery/listings') {
          const { status, body } = upstreamState.listings
          listingDiscoveryResponseStatuses.push(status)
          return Response.json(body, { status })
        }

        if (url.pathname === '/wp-json/wp/v2/posts') {
          return Response.json(upstreamState.wordpress.body, {
            status: upstreamState.wordpress.status,
            headers: {
              'x-wp-total': Array.isArray(upstreamState.wordpress.body)
                ? String(upstreamState.wordpress.body.length)
                : '1',
              'x-wp-totalpages': '1',
            },
          })
        }

        if (url.pathname === '/wp-json/wp/v2/media') {
          return Response.json([], { status: upstreamState.wordpress.status })
        }

        if (url.pathname !== '/api/v1/listings') {
          return new Response('not found', { status: 404 })
        }

        if (upstreamState.directory.status !== 200) {
          return Response.json(upstreamState.directory.body ?? { message: 'directory unavailable' }, {
            status: upstreamState.directory.status,
          })
        }

        if (upstreamState.directory.body !== undefined) {
          return Response.json(upstreamState.directory.body)
        }

        // The homepage asks for its Featured cohort separately. Keep this stub
        // production-shaped so the SSR test can guard the homepage geometry too.
        if (url.searchParams.get('tier') === 'featured') {
          const featured = LISTINGS.filter(listing => listing.tier === 'featured')

          return Response.json({
            data: featured,
            meta: { ...DIRECTORY_META, per_page: 3, to: featured.length, total: featured.length },
          })
        }

        // page=2 simulates a middle page of a real multi-page archive so the
        // suite can prove the previous/next contract and the self-canonical.
        // Matched on the parsed parameter: 'per_page=24' contains 'page=2'.
        if (url.searchParams.get('page') === '2') {
          return Response.json({
            data: LISTINGS,
            meta: { ...DIRECTORY_META, current_page: 2, last_page: 3, from: 29, to: 56, total: 84 },
          })
        }

        // page=5 simulates a deep page whose plan holds no Featured records, so
        // the suite can prove the register renders only when Featured exists.
        if (request.url.includes('page=5')) {
          return Response.json({
            data: LISTINGS.filter(listing => listing.tier === 'basic'),
            meta: { ...DIRECTORY_META, current_page: 5, last_page: 5 },
          })
        }

        return Response.json({ data: LISTINGS, meta: DIRECTORY_META })
      },
    })

    server = spawnNitro()

    await waitForServer()
  })

  afterEach(() => {
    upstreamState = defaultUpstreamState()
    listingDiscoveryResponseStatuses.length = 0
    if (clockFile) writeFileSync(clockFile, '0')
  })

  afterAll(async () => {
    server?.kill()
    await server?.exited
    await upstream?.stop(true)
    if (clockDir) rmSync(clockDir, { recursive: true, force: true })
  })

  test('every listing card is a real anchor to its listing page', async () => {
    const html = await fetch(`${BASE}/browse-all`).then(response => response.text())

    for (const listing of LISTINGS) {
      expect(html).toContain(`href="/listing/${listing.slug}"`)
    }
  })

  test('no literal <NuxtLink> element survives into the SSR output', async () => {
    const html = await fetch(`${BASE}/browse-all`).then(response => response.text())

    // The exact failure mode this test exists for. An unresolved component renders
    // as its own tag name instead of an anchor.
    expect(html).not.toContain('<NuxtLink')
    expect(html).not.toContain('</NuxtLink>')
  })

  test('the anchor count matches the listing count, so no card is left unlinked', async () => {
    const html = await fetch(`${BASE}/browse-all`).then(response => response.text())
    const anchors = html.match(/href="\/listing\//g) ?? []

    expect(anchors).toHaveLength(LISTINGS.length)
  })

  test('every featured card takes the one-row 2x1 footprint', async () => {
    const html = await fetch(`${BASE}/browse-all`).then(response => response.text())
    const cell = (slug: string) => html.match(new RegExp(`<a href="/listing/${slug}"[^>]*class="([^"]*)"`))?.[1]

    for (const slug of ['one-featured', 'two-featured']) {
      const classes = cell(slug)
      expect(classes).toBeDefined()
      expect(classes!).toContain('lg:col-span-2')
      // At sm the grid is two columns wide. A 2-wide paid card followed by its
      // 1-wide companion cannot tile there: the companion takes column 1, the next
      // paid card wraps, and sparse auto-placement never goes back to fill column 2.
      expect(classes!).not.toContain('sm:col-span-2')
    }

    // The retired three-slot Featured geometry must not come back.
    expect(html).not.toContain('lg:col-span-3')
  })

  test('the featured section register renders once, with the disclosure on the card', async () => {
    const html = await fetch(`${BASE}/browse-all`).then(response => response.text())

    // One register label above the featured rows (desktop-only via lg:block, but
    // SSR still emits it once); "Priority placement" belongs to the featured
    // cards' own bands, never to the section header, so the real Standard
    // companions are not mislabeled — and it names the purchased benefit, since
    // both plans are paid.
    expect(html.match(/Featured launches/g) ?? []).toHaveLength(1)
    expect(html.match(/Priority placement/g) ?? []).toHaveLength(2)
    expect(html).not.toContain('Paid placement')
  })

  test('a page without featured records renders no register and no empty section', async () => {
    const html = await fetch(`${BASE}/browse-all?page=5`).then(response => response.text())

    expect(html).not.toContain('Featured launches')
    expect(html).not.toContain('Priority placement')
    expect(html.match(/href="\/listing\//g) ?? []).toHaveLength(26)
  })

  test('tech-products shares the segmented directory presentation', async () => {
    const html = await fetch(`${BASE}/tech-products`).then(response => response.text())

    expect(html.match(/Featured launches/g) ?? []).toHaveLength(1)
    expect(html).not.toContain('<NuxtLink')
    expect(html).toContain('href="/listing/one-featured"')
  })

  test('no mixed directory card is two rows tall', async () => {
    const html = await fetch(`${BASE}/browse-all`).then(response => response.text())

    // Asserted on the bare utility rather than on a concatenated class string:
    // class attribute order is an implementation detail, and a gate that a
    // one-character reordering can silently satisfy is not a gate. The homepage
    // editorial lead is the only surface allowed a row span, and it is not here.
    expect(html).not.toContain('lg:row-span-2')
  })

  test('homepage shows the latest release once and keeps Featured cells compact', async () => {
    const html = await fetch(BASE).then(response => response.text())
    const cell = (slug: string) => html.match(new RegExp(`<a href="/listing/${slug}"[^>]*class="([^"]*)"`))?.[1]

    // The newest record is the release cover, not a second copy inside the
    // Featured grid. The remaining paid cohort keeps equal catalog cells.
    expect(html).toContain('Latest release')
    expect(html).not.toContain('Captured release')
    expect(cell('one-featured')).toBeUndefined()

    const featuredCell = cell('two-featured')
    expect(featuredCell).toBeDefined()
    expect(featuredCell!).not.toContain('sm:col-span-2')
    expect(featuredCell!).not.toContain('lg:col-span-3')
    expect(featuredCell!).not.toContain('row-span-2')

    // Compact Featured cards disclose the tier in their catalog register rather
    // than adding a second full-width priority band to every row.
    expect(html).toContain('>featured</span>')
    expect(html.match(/Priority placement/g) ?? []).toHaveLength(0)
    expect(html).not.toContain('Featured · priority placement')
  })

  test('homepage exposes exactly one main landmark', async () => {
    const html = await fetch(BASE).then(response => response.text())

    expect(html.match(/<main(?:\s|>)/g) ?? []).toHaveLength(1)
  })

  test('no directory card carries a fixed desktop height', async () => {
    const html = await fetch(`${BASE}/browse-all`).then(response => response.text())

    // Every retired attempt at sizing Featured by a fixed number. The row height
    // now comes from the real Standard companion.
    for (const retired of ['lg:h-60', 'xl:h-64', 'lg:h-80']) {
      expect(html).not.toContain(retired)
    }
  })

  test('the directory featured card carries no accent colour', async () => {
    const html = await fetch(`${BASE}/browse-all`).then(response => response.text())
    const cell = html.match(/<a href="\/listing\/one-featured"[\s\S]*?<\/a>/)

    expect(cell).not.toBeNull()
    // Featured is differentiated by composition and typography. The indigo brand
    // accent belongs to the homepage spotlight, not to this card.
    expect(cell![0]).not.toContain('brand-accent')
    // The tier is disclosed in the bottom ledger register (uppercased by CSS),
    // never as a pill — rounded-full anywhere in the card is the old chrome.
    expect(cell![0]).toContain('>featured</span>')
    expect(cell![0]).not.toContain('rounded-full')
  })

  test('browse-all asks the API for a slot-aware directory page', async () => {
    const requestStart = upstreamRequests.length
    await fetch(`${BASE}/browse-all`).then(response => response.text())

    const listingCalls = upstreamRequests
      .slice(requestStart)
      .filter(url => url.includes('/api/v1/listings'))

    expect(listingCalls.length).toBeGreaterThan(0)

    for (const url of listingCalls) {
      // The API owns page membership. Sending per_page as well would ask for a
      // record count and a slot count in the same request.
      expect(url).toContain('view=directory')
      expect(url).toContain('sort=priority')
      expect(url).not.toContain('per_page')
    }
  })

  test('the archive states its record range and page position', async () => {
    const html = await fetch(`${BASE}/browse-all`).then(response => response.text())

    // The count row is the reader's only proof that a slot-aware page returned a
    // variable record count; the restyle changes its material, never its facts.
    expect(html).toContain('Showing 1\u201328 of 28 products')
    expect(html).toContain('Page 1 of 1')
  })

  test('a numbered page links backwards and forwards without losing the archive', async () => {
    const html = await fetch(`${BASE}/browse-all?page=2`).then(response => response.text())

    expect(html).toContain('Showing 29\u201356 of 84 products')
    expect(html).toContain('Page 2 of 3')
    // Page 1 drops the query so the archive has exactly one page-1 URL.
    expect(html).toContain('href="/browse-all"')
    expect(html).toContain('href="/browse-all?page=3"')
    expect(html).toContain('rel="prev"')
    expect(html).toContain('rel="next"')
    // Self-canonical: a numbered page is its own indexable URL.
    expect(html).toContain('https://launchlog.ai/browse-all?page=2')
  })

  test('every record on a numbered page stays reachable through a real archive link', async () => {
    const html = await fetch(`${BASE}/browse-all?page=2`).then(response => response.text())

    expect(html.match(/href="\/listing\//g) ?? []).toHaveLength(LISTINGS.length)
    expect(html).not.toContain('<NuxtLink')
  })

  test('a non-canonical page parameter collapses to the base archive and is not indexed', async () => {
    const html = await fetch(`${BASE}/browse-all?page=01`).then(response => response.text())

    expect(html).toContain('noindex, follow')
    expect(html).toContain('https://launchlog.ai/browse-all"')
    // No paginated canonical, and no rel=prev/next off a URL that is not part
    // of the canonical sequence.
    expect(html).not.toContain('https://launchlog.ai/browse-all?page=')
  })

  test('a filtered archive stays crawlable but is not indexed', async () => {
    const html = await fetch(`${BASE}/browse-all?category=saas`).then(response => response.text())

    expect(html).toContain('noindex, follow')
    expect(html).toContain('https://launchlog.ai/browse-all"')
    expect(html.match(/href="\/listing\//g) ?? []).toHaveLength(LISTINGS.length)
  })

  test('the archive chrome carries no retired pill, accent or surface language', async () => {
    for (const path of ['/browse-all', '/tech-products', '/featured']) {
      const html = await fetch(`${BASE}${path}`).then(response => response.text())

      expect(html).not.toContain('rounded-full')
      expect(html).not.toContain('rounded-2xl')
      expect(html).not.toContain('emerald-')
      expect(html).not.toContain('bg-white/[')
      expect(html).not.toContain('border-white/')
      expect(html).not.toContain('bg-primary')
      expect(html).not.toContain('linear-gradient')
      expect(html).not.toMatch(/violet|purple|indigo|mauve/i)
    }
  })

  test('the archive is composed from Release Catalog materials', async () => {
    for (const path of ['/browse-all', '/tech-products', '/featured']) {
      const html = await fetch(`${BASE}${path}`).then(response => response.text())

      expect(html).toContain('border-release-seam')
      expect(html).toContain('bg-release-ink')
      expect(html).toContain('text-release-blaze')
    }
  })

  test('listing names render as h2 on a top-level directory page', async () => {
    const html = await fetch(`${BASE}/browse-all`).then(response => response.text())

    // The page's own title is the h1, so cards must not jump straight to h3.
    expect(html).toContain('<h2 class="min-w-0 font-semibold text-[#f6f1e7]')
  })

  test.each([
    ['listing discovery failure', () => {
      upstreamState.listings = { status: 503, body: { message: 'listing discovery unavailable' } }
    }],
    ['directory pagination failure', () => {
      upstreamState.directory = { status: 503, body: { message: 'directory unavailable' } }
    }],
    ['WordPress blog failure', () => {
      upstreamState.wordpress = { status: 503, body: { message: 'blog unavailable' } }
    }],
    ['malformed listing envelope', () => {
      upstreamState.listings = { status: 200, body: { data: {} } }
    }],
    ['malformed listing item', () => {
      upstreamState.listings = {
        status: 200,
        body: { data: [{ slug: 'broken', name: 'Broken', tagline: null }] },
      }
    }],
  ])('fails a fresh sitemap closed for %s', async (_name, setFailure) => {
    upstreamState.directory = seededDirectoryState()
    setFailure()
    await restartNitroInstance()

    const response = await fetch(`${BASE}/sitemap.xml`)
    const body = await response.text()

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body).not.toContain('<urlset')
    expect(body).not.toContain('/listing/seeded')
    expect(body).not.toContain('/blog/seeded-article')
    expect(body).not.toContain('/browse-all?page=2')
    expect(body).not.toContain('/tech-products?page=2')
    expect(body).not.toContain('/featured?page=2')
  })

  test('keeps truthful empty listing and blog discovery data indexable', async () => {
    upstreamState.listings = { status: 200, body: { data: [] } }
    upstreamState.wordpress = { status: 200, body: [] }
    await restartNitroInstance()

    const response = await fetch(`${BASE}/sitemap.xml`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=0, s-maxage=600, stale-while-revalidate=600',
    )
    expect(body).toContain('<urlset')
    expect(body).not.toContain('/listing/seeded')
    expect(body).not.toContain('/blog/seeded-article')
  })

  test('serves only a complete stale sitemap during refresh failure and replaces it on recovery', async () => {
    await restartNitroInstance()

    const seeded = await fetch(`${BASE}/sitemap.xml`)
    const seededBody = await seeded.text()
    const publicSitemapCache = 'public, max-age=0, s-maxage=600, stale-while-revalidate=600'

    expect(seeded.status).toBe(200)
    expect(seeded.headers.get('cache-control')).toBe(publicSitemapCache)
    expect(seededBody).toContain('/listing/seeded')

    advanceFixtureClockBy(601)
    upstreamState.listings = { status: 503, body: { message: 'listing discovery unavailable' } }
    const refreshRequestStart = listingDiscoveryResponseStatuses.length

    const stale = await fetch(`${BASE}/sitemap.xml`)
    const staleBody = await stale.text()

    expect(stale.status).toBe(200)
    expect(stale.headers.get('cache-control')).toBe(publicSitemapCache)
    expect(staleBody).toBe(seededBody)
    expect(staleBody).toContain('/listing/seeded')

    await waitForListingDiscoveryResponse(503, refreshRequestStart)
    expect(listingDiscoveryResponseStatuses.slice(refreshRequestStart)).toContain(503)

    const staleAfterFailedRefresh = await fetch(`${BASE}/sitemap.xml`)
    expect(staleAfterFailedRefresh.status).toBe(200)
    expect(staleAfterFailedRefresh.headers.get('cache-control')).toBe(publicSitemapCache)
    expect(await staleAfterFailedRefresh.text()).toBe(seededBody)

    upstreamState.listings = { status: 200, body: { data: [discoveryListing('recovered')] } }
    await waitForBody(`${BASE}/sitemap.xml`, '/listing/recovered')

    const recovered = await fetch(`${BASE}/sitemap.xml`)
    expect(recovered.status).toBe(200)
    expect(recovered.headers.get('cache-control')).toBe(publicSitemapCache)
    expect(await recovered.text()).toContain('/listing/recovered')
  })

  test.each([
    ['listing discovery failure', () => {
      upstreamState.listings = { status: 503, body: { message: 'listing discovery unavailable' } }
    }],
    ['WordPress blog failure', () => {
      upstreamState.wordpress = { status: 503, body: { message: 'blog unavailable' } }
    }],
    ['malformed listing envelope', () => {
      upstreamState.listings = { status: 200, body: { data: {} } }
    }],
    ['malformed listing item', () => {
      upstreamState.listings = {
        status: 200,
        body: { data: [{ slug: 'broken', name: 'Broken', tagline: null }] },
      }
    }],
    ['malformed WordPress payload', () => {
      upstreamState.wordpress = { status: 200, body: { posts: [] } }
    }],
  ])('returns an atomic llms-full 503 for %s', async (_name, setFailure) => {
    setFailure()
    await restartNitroInstance()

    const response = await fetch(`${BASE}/llms-full.txt`)
    const body = await response.text()

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body).toBe('# LaunchLog — temporarily unavailable\n')
    expect(body).not.toContain('## Published listings')
    expect(body).not.toContain('## Published blog articles')
  })

  test('renders truthful empty llms-full sections with the public SWR contract', async () => {
    upstreamState.listings = { status: 200, body: { data: [] } }
    upstreamState.wordpress = { status: 200, body: [] }
    await restartNitroInstance()

    const response = await fetch(`${BASE}/llms-full.txt`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=0, s-maxage=600, stale-while-revalidate=600',
    )
    expect(body).toContain('## Published listings')
    expect(body).toContain('(No public listings indexed yet.)')
    expect(body).toContain('## Published blog articles')
    expect(body).toContain('(No articles available.)')
  })
})
