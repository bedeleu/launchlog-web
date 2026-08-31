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

const summary = (slug: string, itemCount: number) => ({
  slug,
  week_starts_at: slug === '2026-w35' ? '2026-08-24' : '2026-08-17',
  week_ends_at: slug === '2026-w35' ? '2026-08-30' : '2026-08-23',
  introduction: `The durable release record for ${slug}.`,
  published_at: '2026-08-31T00:00:00+00:00',
  modified_at: '2026-08-31T00:05:00+00:00',
  item_count: itemCount,
  path: `/shipped/${slug}`,
})

const CURRENT_PATH = '/listing/current-launch'
const CARRIED_PATH = '/listing/carried-launch'
const WITHDRAWN_NAME = 'Withdrawn </script><script>window.__edition_pwned=1</script>'

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

type UpstreamMode = 'ok' | 'editions-503' | 'listings-503'

let mode: UpstreamMode = 'ok'
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
          return Response.json({ data: records })
        }

        if (url.pathname === '/api/v1/discovery/editions') {
          if (mode === 'editions-503') {
            return Response.json({ message: 'edition source unavailable' }, { status: 503 })
          }
          const page = Number(url.searchParams.get('page') ?? 1)
          if (page === 1) {
            return Response.json({
              data: [summary('2026-w35', 3)],
              meta: { current_page: 1, last_page: 2, per_page: 24, total: 2 },
            })
          }
          if (page === 2) {
            return Response.json({
              data: [summary('2026-w34', 1)],
              meta: { current_page: 2, last_page: 2, per_page: 24, total: 2 },
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
    expect(secondHtml).toContain('2026-w34')
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
    expect(output).toMatch(/"\/shipped":\s*\{\s*"swr":\s*600\s*\}/)
    expect(output).toMatch(/"\/shipped\/\*\*":\s*\{\s*"swr":\s*600\s*\}/)
  })
})
