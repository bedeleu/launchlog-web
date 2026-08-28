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

        const url = new URL(request.url)

        // The homepage asks for its Featured cohort separately. Keep this stub
        // production-shaped so the SSR test can guard the homepage geometry too.
        if (url.searchParams.get('tier') === 'featured') {
          const featured = LISTINGS.filter(listing => listing.tier === 'featured')

          return Response.json({
            data: featured,
            meta: { ...DIRECTORY_META, per_page: 3, to: featured.length, total: featured.length },
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

  test('homepage featured listings share one aligned 2x1 presentation', async () => {
    const html = await fetch(BASE).then(response => response.text())
    const cell = (slug: string) => html.match(new RegExp(`<a href="/listing/${slug}"[^>]*class="([^"]*)"`))?.[1]

    for (const slug of ['one-featured', 'two-featured']) {
      const classes = cell(slug)
      expect(classes).toBeDefined()
      expect(classes!).toContain('sm:col-span-2')
      expect(classes!).toContain('lg:col-span-3')
      expect(classes!).not.toContain('row-span-2')
    }

    // Disclosure now belongs to each real placement band; the duplicate section
    // register and its misleading one-lead hierarchy are both retired.
    expect(html.match(/Priority placement/g) ?? []).toHaveLength(2)
    expect(html).not.toContain('Featured · priority placement')
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

  test('listing names render as h2 on a top-level directory page', async () => {
    const html = await fetch(`${BASE}/browse-all`).then(response => response.text())

    // The page's own title is the h1, so cards must not jump straight to h3.
    expect(html).toContain('<h2 class="min-w-0 font-semibold text-[#f6f1e7]')
  })
})
