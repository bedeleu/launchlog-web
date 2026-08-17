import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
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

const card = (slug: string, tier: 'basic' | 'premium' | 'featured') => ({
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

// A production-shaped slot-aware page: 1 Featured (3 slots) + 1 Premium (2) +
// 25 Basic (25) spends exactly the 30 visual slots a directory page owns.
// Mirrors the API's tier-major ordering: featured, then premium, then basic.
const LISTINGS = [
  card('one-featured', 'featured'),
  card('two-premium', 'premium'),
  ...Array.from({ length: 25 }, (_, index) =>
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

/** Every upstream URL the SSR render asked for, so tests can assert the request. */
const upstreamRequests: string[] = []

let upstream: ReturnType<typeof Bun.serve> | undefined
let server: ReturnType<typeof Bun.spawn> | undefined

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

describe.skipIf(!isBuilt)('directory SSR renders real anchors', () => {
  beforeAll(async () => {
    upstream = Bun.serve({
      port: UPSTREAM_PORT,
      fetch(request) {
        upstreamRequests.push(request.url)

        return Response.json({ data: LISTINGS, meta: DIRECTORY_META })
      },
    })

    server = Bun.spawn({
      cmd: ['node', serverEntry],
      env: {
        ...process.env,
        PORT: String(SERVER_PORT),
        NUXT_PUBLIC_API_URL: `http://127.0.0.1:${UPSTREAM_PORT}`,
      },
      stdout: 'ignore',
      stderr: 'ignore',
    })

    await waitForServer()
  })

  afterAll(() => {
    server?.kill()
    upstream?.stop(true)
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

  test('paid cards take one-row 3x1 and 2x1 footprints', async () => {
    const html = await fetch(`${BASE}/browse-all`).then(response => response.text())

    // Featured spans all three columns, Premium two of three.
    expect(html).toContain('lg:col-span-3')
    expect(html).toContain('lg:col-span-2')
  })

  test('no mixed directory card is two rows tall', async () => {
    const html = await fetch(`${BASE}/browse-all`).then(response => response.text())

    // Asserted on the bare utility rather than on a concatenated class string:
    // class attribute order is an implementation detail, and a gate that a
    // one-character reordering can silently satisfy is not a gate. The homepage
    // editorial lead is the only surface allowed a row span, and it is not here.
    expect(html).not.toContain('lg:row-span-2')
  })

  test('the featured card is height-capped on desktop instead of running tall', async () => {
    const html = await fetch(`${BASE}/browse-all`).then(response => response.text())

    expect(html).toContain('lg:h-60')
    expect(html).toContain('xl:h-64')
  })

  test('browse-all asks the API for a slot-aware directory page', async () => {
    await fetch(`${BASE}/browse-all`).then(response => response.text())

    const listingCalls = upstreamRequests.filter(url => url.includes('/api/v1/listings'))

    expect(listingCalls.length).toBeGreaterThan(0)

    for (const url of listingCalls) {
      // The API owns page membership. Sending per_page as well would ask for a
      // record count and a slot count in the same request.
      expect(url).toContain('view=directory')
      expect(url).toContain('sort=priority')
      expect(url).not.toContain('per_page')
    }
  })

  test('listing names render as h2 on a top-level directory page', async () => {
    const html = await fetch(`${BASE}/browse-all`).then(response => response.text())

    // The page's own title is the h1, so cards must not jump straight to h3.
    expect(html).toContain('<h2 class="min-w-0 font-semibold text-brand-fg')
  })
})
