import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const serverEntry = fileURLToPath(new URL('../.output/server/index.mjs', import.meta.url))
const isBuilt = existsSync(serverEntry)

if (!isBuilt && process.env.SSR_TESTS === 'required') {
  throw new Error(`SSR_TESTS=required but ${serverEntry} is missing — run "bun run build" first`)
}

const UPSTREAM_PORT = 3301
const SERVER_PORT = 3300
const BASE = `http://127.0.0.1:${SERVER_PORT}`

let upstream: ReturnType<typeof Bun.serve> | undefined
let server: ReturnType<typeof Bun.spawn> | undefined

async function waitForServer(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE}/robots.txt`)).ok) return
    }
    catch {
      // The exact child process has not started listening yet.
    }
    await Bun.sleep(250)
  }
  throw new Error(`SSR server did not become ready on ${BASE}`)
}

function jsonLdFrom(html: string): unknown[] {
  return [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1]!))
}

function offersFrom(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap(offersFrom)
  if (typeof value !== 'object' || value === null) return []
  const record = value as Record<string, unknown>
  if (record['@type'] === 'Offer') return [record]
  return Object.values(record).flatMap(offersFrom)
}

describe.skipIf(!isBuilt)('commercial product truth', () => {
  beforeAll(async () => {
    upstream = Bun.serve({
      port: UPSTREAM_PORT,
      fetch: () => Response.json({ data: [] }),
    })
    server = Bun.spawn({
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
    await waitForServer()
  })

  afterAll(() => {
    server?.kill()
    upstream?.stop(true)
  })

  test('renders exactly the two public offers in HTML and JSON-LD', async () => {
    for (const path of ['/pricing', '/help']) {
      const response = await fetch(`${BASE}${path}`)
      const html = await response.text()
      expect(response.status).toBe(200)
      expect(html).toContain('$24.99')
      expect(html).toContain('$99')
      expect(html).not.toMatch(/LaunchLog Premium|\$59\.99|\$149|human[- ]reviewed/i)
    }

    for (const path of ['/', '/about']) {
      const response = await fetch(`${BASE}${path}`)
      const offers = jsonLdFrom(await response.text()).flatMap(offersFrom)
      expect(response.status).toBe(200)
      expect(offers).toHaveLength(2)
      expect(offers).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: expect.stringContaining('Standard'), price: '24.99', priceCurrency: 'USD' }),
        expect.objectContaining({ name: expect.stringContaining('Featured'), price: '99.00', priceCurrency: 'USD' }),
      ]))
      expect(JSON.stringify(offers)).not.toMatch(/Premium|59\.99|149\.00/)
    }
  })

  test('defaults absent and unknown submit tiers to Standard', async () => {
    for (const suffix of ['', '?tier=premium']) {
      const response = await fetch(`${BASE}/submit${suffix}`)
      const html = await response.text()
      expect(response.status).toBe(200)
      expect(html).toMatch(/Starting with <span[^>]*>Standard<\/span>/)
      expect(html).not.toMatch(/Starting with <span[^>]*>Featured<\/span>/)
    }
  })

  test('keeps basic as an API enum while naming visible placements Standard', async () => {
    const response = await fetch(`${BASE}/api-docs`)
    const html = await response.text()
    expect(response.status).toBe(200)
    expect(html).toContain('basic or featured')
    expect(html).toContain('Standard companion')
    expect(html).toContain('ordinary Standard listing')
    expect(html).not.toContain('real basic companion')
  })
})
