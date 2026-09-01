import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
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
type NewsletterCapabilityMode = 'enabled' | 'disabled' | 'unavailable'
let newsletterCapabilityMode: NewsletterCapabilityMode = 'disabled'
let newsletterSubscriptionCalls = 0

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

describe.skipIf(!isBuilt)('commercial product truth', () => {
  beforeAll(async () => {
    upstream = Bun.serve({
      port: UPSTREAM_PORT,
      fetch(request) {
        const url = new URL(request.url)

        if (url.pathname === '/api/v1/newsletter/capability') {
          if (newsletterCapabilityMode === 'unavailable') {
            return Response.json({ message: 'capability unavailable' }, { status: 503 })
          }

          return Response.json({ enabled: newsletterCapabilityMode === 'enabled' })
        }

        if (url.pathname === '/api/v1/newsletter/subscriptions') {
          newsletterSubscriptionCalls += 1
          return Response.json({ accepted: true }, { status: 202 })
        }

        return Response.json({ data: [] })
      },
    })
    server = spawnNitro()
    await waitForServer()
  })

  beforeEach(() => {
    newsletterCapabilityMode = 'disabled'
    newsletterSubscriptionCalls = 0
  })

  afterAll(async () => {
    server?.kill()
    await server?.exited
    await upstream?.stop(true)
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
      expect(html).toContain('Starting placement · Standard')
      expect(html).not.toContain('Starting placement · Featured')
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

  test('discloses newsletter processing without claiming browser persistence or checkout consent', async () => {
    const privacyResponse = await fetch(`${BASE}/privacy`)
    const privacy = await privacyResponse.text()
    const cookiesResponse = await fetch(`${BASE}/cookies`)
    const cookies = await cookiesResponse.text()

    expect(privacyResponse.status).toBe(200)
    expect(privacy).toContain('Beehiiv')
    expect(privacy).toMatch(/double opt-in/i)
    expect(privacy).toMatch(/unsubscribe/i)
    expect(privacy).toMatch(/does not keep a local newsletter subscriber ledger/i)
    expect(privacy).toMatch(/separate from checkout/i)
    expect(privacy).toContain('September 1, 2026')
    expect(privacy).toContain('2026-09-01')

    expect(cookiesResponse.status).toBe(200)
    expect(cookies).toMatch(/newsletter form does not store/i)
    expect(cookies).toMatch(/local storage/i)
    expect(cookies).toMatch(/session storage/i)
    expect(cookies).toMatch(/IndexedDB/i)
    expect(cookies).toMatch(/server-to-server to Beehiiv/i)
    expect(cookies).toContain('September 1, 2026')
    expect(cookies).toContain('2026-09-01')
  })

  test('renders homepage newsletter capture only for an affirmative SSR capability', async () => {
    for (const closedMode of ['disabled', 'unavailable'] as const) {
      newsletterCapabilityMode = closedMode
      await restartNitro()

      const response = await fetch(BASE)
      const html = await response.text()

      expect(response.status).toBe(200)
      expect(html).toContain('The log of what just shipped.')
      expect(html).not.toContain('data-newsletter-source="homepage"')
      expect(html).not.toContain('id="newsletter-homepage"')
      expect(html).not.toContain('One concise weekly edition')
    }

    newsletterCapabilityMode = 'enabled'
    await restartNitro()

    const response = await fetch(BASE)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('data-newsletter-source="homepage"')
    expect(html).toContain('id="newsletter-homepage"')
    expect(html).toContain('One concise weekly edition')
    expect(html).toContain('href="/privacy"')
    expect(newsletterSubscriptionCalls).toBe(0)
  })
})
