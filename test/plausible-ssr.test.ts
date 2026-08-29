import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Optional analytics must never render in SSR HTML because the browser has not yet
// established a valid consent record. A client plugin may load it only after opt-in.
const serverEntry = fileURLToPath(new URL('../.output/server/index.mjs', import.meta.url))
const isBuilt = existsSync(serverEntry)

if (!isBuilt && process.env.SSR_TESTS === 'required') {
  throw new Error(`SSR_TESTS=required but ${serverEntry} is missing — run "bun run build" first`)
}

const UPSTREAM_PORT = 3205
const SERVER_PORT = 3206
const ENDPOINT = 'https://plausible.launchlog.ai/api/event'

const EMPTY_META = {
  current_page: 1, from: 0, last_page: 1, per_page: 30, to: 0, total: 0,
  slot_capacity: 30, slots_used: 0,
}

let upstream: ReturnType<typeof Bun.serve> | undefined
let server: ReturnType<typeof Bun.spawn> | undefined

async function waitFor(base: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${base}/robots.txt`)).ok) return
    }
    catch { /* not up yet */ }
    await Bun.sleep(250)
  }
  throw new Error(`SSR server did not become ready on ${base}`)
}

describe.skipIf(!isBuilt)('Plausible consent boundary (SSR)', () => {
  beforeAll(async () => {
    upstream = Bun.serve({
      port: UPSTREAM_PORT,
      fetch() {
        return Response.json({ data: [], meta: EMPTY_META })
      },
    })

    const baseEnv = {
      ...process.env,
      NUXT_PUBLIC_API_URL: `http://127.0.0.1:${UPSTREAM_PORT}`,
    }

    server = Bun.spawn({
      cmd: ['node', serverEntry],
      env: {
        ...baseEnv,
        PORT: String(SERVER_PORT),
        NUXT_PUBLIC_PLAUSIBLE_ENABLED: 'true',
        NUXT_PUBLIC_PLAUSIBLE_DOMAIN: 'launchlog.ai',
        NUXT_PUBLIC_PLAUSIBLE_ENDPOINT: ENDPOINT,
        NUXT_PUBLIC_META_PIXEL_ENABLED: 'true',
        NUXT_PUBLIC_META_PIXEL_ID: '123456789012345',
      },
      stdout: 'ignore', stderr: 'ignore',
    })

    await waitFor(`http://127.0.0.1:${SERVER_PORT}`)
  })

  afterAll(() => {
    server?.kill()
    upstream?.stop(true)
  })

  test('renders no analytics script or queue before browser consent', async () => {
    const html = await fetch(`http://127.0.0.1:${SERVER_PORT}/`).then(r => r.text())
    const scriptTags = html.match(/<script\b[^>]*>/g) ?? []

    // Nuxt serializes public runtime configuration into the payload. The API
    // endpoint may therefore exist as inert data, but it must never be a script.
    expect(scriptTags.some(tag => tag.includes(`src="${ENDPOINT}"`))).toBe(false)
    expect(html).not.toContain('data-launchlog-analytics')
    expect(html).not.toContain('window.plausible=')
    expect(scriptTags.some(tag => tag.includes('connect.facebook.net'))).toBe(false)
    expect(html).not.toContain('launchlog-meta-pixel')
    expect(html).not.toContain('window.fbq=')
  })

  test('keeps the server conversion endpoint closed when its private capability is disabled', async () => {
    const response = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/meta-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://launchlog.ai',
      },
      body: JSON.stringify({
        event: 'Preview Created',
        eventId: '123e4567-e89b-42d3-a456-426614174000',
        advertisingConsent: true,
      }),
    })

    expect(response.status).toBe(503)
  })
})
