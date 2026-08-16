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

// Mirrors the API's tier-major ordering: featured, then premium, then basic.
const LISTINGS = [
  card('one-featured', 'featured'),
  card('two-premium', 'premium'),
  card('three-basic', 'basic'),
  card('four-basic', 'basic'),
  card('five-basic', 'basic'),
]

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
      fetch() {
        return Response.json({
          data: LISTINGS,
          meta: { current_page: 1, from: 1, last_page: 1, per_page: 24, to: LISTINGS.length, total: LISTINGS.length },
        })
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

  test('page one applies the bento footprints to the paid tiers', async () => {
    const html = await fetch(`${BASE}/browse-all`).then(response => response.text())

    // Featured spans the full 3-column row and two rows; Premium spans two of three.
    expect(html).toContain('lg:col-span-3 lg:row-span-2')
    expect(html).toContain('lg:col-span-2 lg:row-span-2')
  })

  test('listing names render as h2 on a top-level directory page', async () => {
    const html = await fetch(`${BASE}/browse-all`).then(response => response.text())

    // The page's own title is the h1, so cards must not jump straight to h3.
    expect(html).toContain('<h2 class="min-w-0 font-semibold text-brand-fg')
  })
})
