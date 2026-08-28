import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const serverEntry = fileURLToPath(new URL('../.output/server/index.mjs', import.meta.url))
const isBuilt = existsSync(serverEntry)

if (!isBuilt && process.env.SSR_TESTS === 'required') {
  throw new Error(`SSR_TESTS=required but ${serverEntry} is missing — run "bun run build" first`)
}

const UPSTREAM_PORT = 3207
const SERVER_PORT = 3206
const BASE = `http://127.0.0.1:${SERVER_PORT}`

const LISTING = {
  slug: 'proof-product',
  name: 'Proof Product',
  tagline: 'A machine-readable launch.',
  description: 'The receipt exposes the real artifact behind every claim.',
  url: 'https://proof.example.com',
  screenshot_url: null,
  tier: 'basic',
  source: 'paid',
  category: { name: 'Developer Tools', slug: 'developer-tools' },
  tags: [{ name: 'Proof', slug: 'proof' }],
  tech_stack: ['Nuxt'],
  has_llms_txt: true,
  has_schema_org: true,
  has_markdown_negotiation: true,
  country: null,
  pricing: null,
  published_at: '2026-08-26T00:00:00Z',
}

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
      // Server is still starting.
    }
    await Bun.sleep(250)
  }

  throw new Error(`SSR server did not become ready on ${BASE}`)
}

describe.skipIf(!isBuilt)('listing receipt proof routes', () => {
  beforeAll(async () => {
    upstream = Bun.serve({
      port: UPSTREAM_PORT,
      fetch(request) {
        const { pathname } = new URL(request.url)
        if (pathname === '/api/v1/listings/proof-product') {
          return Response.json({ data: LISTING })
        }
        if (pathname === '/api/v1/listings/withdrawn-product') {
          return Response.json({ message: 'Gone' }, { status: 410 })
        }
        return Response.json({ message: 'Not found' }, { status: 404 })
      },
    })

    server = Bun.spawn({
      cmd: ['node', serverEntry],
      env: {
        ...process.env,
        PORT: String(SERVER_PORT),
        NUXT_PUBLIC_API_URL: `http://127.0.0.1:${UPSTREAM_PORT}`,
        NUXT_PUBLIC_DOMAIN: 'launchlog.ai',
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

  test('opens the listing JSON-LD as a distinct inspectable artifact', async () => {
    const response = await fetch(`${BASE}/listing/proof-product/schema`)
    expect(response.status).toBe(200)

    const schema = await response.json() as { '@context': string, '@graph': Array<Record<string, unknown>> }
    expect(response.headers.get('content-type')).toContain('application/ld+json')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(schema['@context']).toBe('https://schema.org')
    expect(schema['@graph'].some(node => node['@type'] === 'SoftwareApplication' && node.name === 'Proof Product')).toBeTrue()
  })

  test('opens the negotiated listing Markdown as a distinct browser URL', async () => {
    const response = await fetch(`${BASE}/listing/proof-product/markdown`)
    const markdown = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/markdown')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(markdown).toContain('# Proof Product')
    expect(markdown).toContain('**Website:** https://proof.example.com')
  })
  test('serves the negotiated Markdown on the listing URL itself', async () => {
    const response = await fetch(`${BASE}/listing/proof-product`, {
      headers: { Accept: 'text/markdown' },
    })
    const markdown = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/markdown')
    expect(response.headers.get('vary')).toBe('Accept')
    expect(response.headers.get('content-signal')).toBe('ai-train=yes, search=yes, ai-input=yes')
    expect(markdown).toContain('# Proof Product')
  })

  test('keeps the proof routes reachable for the AI clients that send Accept: text/markdown', async () => {
    // The negotiation middleware runs before every /listing/* route. It used to
    // treat 'proof-product/markdown' as a slug, ask the API for it, and answer
    // the exact client the feature exists for with a 404.
    const markdown = await fetch(`${BASE}/listing/proof-product/markdown`, {
      headers: { Accept: 'text/markdown' },
    })
    expect(markdown.status).toBe(200)
    expect(markdown.headers.get('content-type')).toContain('text/markdown')
    expect(await markdown.text()).toContain('# Proof Product')

    const schema = await fetch(`${BASE}/listing/proof-product/schema`, {
      headers: { Accept: 'text/markdown' },
    })
    expect(schema.status).toBe(200)
    expect(schema.headers.get('content-type')).toContain('application/ld+json')
  })

  test('the public record links four distinct proof destinations', async () => {
    const html = await fetch(`${BASE}/listing/proof-product`).then(response => response.text())

    for (const href of [
      'https://launchlog.ai/listing/proof-product"',
      'https://launchlog.ai/listing/proof-product/schema"',
      'https://launchlog.ai/listing/proof-product/markdown"',
      'https://launchlog.ai/llms-full.txt"',
    ]) {
      expect(html).toContain(`href="${href}`)
    }

    expect(html).toContain('Public page')
    expect(html).toContain('Structured data')
    expect(html).toContain('Markdown representation')
    expect(html).toContain('Discovery feed')
    // The retired AI framing and its unlinked check marks.
    expect(html).not.toContain('AI Discovery')
    expect(html).not.toContain('Included in llms.txt surfaces')
    expect(html).not.toContain('Sitemap discovery')
  })

  test('the public record is built from Release Catalog materials', async () => {
    const html = await fetch(`${BASE}/listing/proof-product`).then(response => response.text())

    expect(html).toContain('border-release-seam')
    expect(html).toContain('bg-release-ink')
    expect(html).not.toContain('rounded-full')
    expect(html).not.toContain('rounded-2xl')
    expect(html).not.toContain('bg-white/[')
    expect(html).not.toContain('border-white/')
    expect(html).not.toContain('bg-primary')
    expect(html).not.toContain('linear-gradient')
    expect(html).not.toMatch(/violet|purple|indigo|mauve/i)
    // The retired featured frame mixed an orange ring with a hardcoded indigo glow.
    expect(html).not.toContain('rgba(99,102,241')
  })

  test('embeds the JSON-LD graph with no unsafe literal angle bracket', async () => {
    const html = await fetch(`${BASE}/listing/proof-product`).then(response => response.text())
    const graph = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)

    expect(graph).not.toBeNull()
    expect(graph![1]).not.toContain('<')
    expect(JSON.parse(graph![1]!)['@context']).toBe('https://schema.org')
  })

  test('a withdrawn release is 410 and says so, instead of blaming the link', async () => {
    const response = await fetch(`${BASE}/listing/withdrawn-product`)
    const html = await response.text()

    expect(response.status).toBe(410)
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(html).toContain('noindex, nofollow')
    expect(html).toContain('Release withdrawn')
    expect(html).not.toContain('the link is incorrect')
  })

  test('a missing release is 404 and keeps its own copy', async () => {
    const response = await fetch(`${BASE}/listing/no-such-product`)
    const html = await response.text()

    expect(response.status).toBe(404)
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(html).toContain('Release not found')
    expect(html).not.toContain('Release withdrawn')
  })
})
