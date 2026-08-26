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
})
