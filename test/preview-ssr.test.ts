import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const serverEntry = fileURLToPath(new URL('../.output/server/index.mjs', import.meta.url))
const isBuilt = existsSync(serverEntry)

if (!isBuilt && process.env.SSR_TESTS === 'required') {
  throw new Error(`SSR_TESTS=required but ${serverEntry} is missing — run "bun run build" first`)
}

const API_PORT = 3203
const SERVER_PORT = 3202
const BASE = `http://127.0.0.1:${SERVER_PORT}`
const GENERATING_TOKEN = 'g'.repeat(64)
const CONFLICT_TOKEN = 'c'.repeat(64)
const RESERVED_TOKEN = 'r'.repeat(64)

const preview = (status: 'generating' | 'failed') => ({
  token: status === 'generating' ? GENERATING_TOKEN : CONFLICT_TOKEN,
  status,
  source_url: 'https://maker.example',
  url: 'https://maker.example',
  domain: 'maker.example',
  title: status === 'generating' ? null : 'Maker',
  tagline: status === 'generating' ? null : 'A represented website.',
  description: null,
  primary_category_id: null,
  email: null,
  tier: null,
  screenshot_url: null,
  crawl: null,
  error_code: status === 'failed' ? 'domain_conflict' : null,
  error_message: status === 'failed' ? 'This website is already represented on LaunchLog.' : null,
  existing_listing: status === 'failed'
    ? { action: 'claim', domain: 'maker.example', listing_path: '/listing/maker-example', dashboard_path: null }
    : null,
  checkout_reserved: false,
  expires_at: '2026-09-01T00:00:00Z',
})

const reservedPreview = {
  ...preview('failed'),
  token: RESERVED_TOKEN,
  status: 'ready',
  title: 'Reserved maker',
  tagline: 'A saved checkout.',
  email: 'maker@example.com',
  tier: 'featured',
  error_code: null,
  error_message: null,
  existing_listing: null,
  checkout_reserved: true,
}

let api: ReturnType<typeof Bun.serve> | undefined
let server: ReturnType<typeof Bun.spawn> | undefined

async function waitForServer(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE}/robots.txt`)).ok) return
    }
    catch {
      // not listening yet
    }
    await Bun.sleep(150)
  }
  throw new Error('Nitro server did not become ready in time')
}

describe.skipIf(!isBuilt)('preview and ownership-request SSR', () => {
  beforeAll(async () => {
    api = Bun.serve({
      port: API_PORT,
      fetch(request) {
        const path = new URL(request.url).pathname
        if (path.endsWith(GENERATING_TOKEN)) return Response.json({ data: preview('generating') })
        if (path.endsWith(CONFLICT_TOKEN)) return Response.json({ data: preview('failed') })
        if (path.endsWith(RESERVED_TOKEN)) return Response.json({ data: reservedPreview })
        return Response.json({ message: 'not found' }, { status: 404 })
      },
    })

    server = Bun.spawn({
      cmd: ['node', serverEntry],
      env: {
        ...process.env,
        PORT: String(SERVER_PORT),
        NITRO_PORT: String(SERVER_PORT),
        NUXT_PUBLIC_API_URL: `http://127.0.0.1:${API_PORT}`,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    await waitForServer()
  })

  afterAll(() => {
    server?.kill()
    api?.stop(true)
  })

  test('generation keeps the real product surface visible instead of a blank skeleton', async () => {
    const response = await fetch(`${BASE}/preview/${GENERATING_TOKEN}`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('Private release recorder')
    expect(html).toContain('Reading the website')
    expect(html).toContain('Validate')
    expect(html).toContain('Ready')
    expect(html).toContain('maker.example')
    expect(html).toContain('Your LaunchLog placement')
    expect(html).toContain('We’re reading your website details.')
    expect(html).toContain('hidden sm:block')
    expect(html).toContain('01 — Checking access')
    expect(html).toContain('Checking publishing access…')
    expect(html).not.toContain('Pay &amp; publish')
    expect(html).toContain('Preparing preview…')
    expect(html).toContain('Checkout unlocks automatically when the preview is ready.')
    expect(html).not.toContain('Generating your preview — capturing the screenshot and details')
  })

  test('a represented domain has ownership actions and no payment action', async () => {
    const response = await fetch(`${BASE}/preview/${CONFLICT_TOKEN}`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('Release already cataloged')
    expect(html).toContain('Request ownership')
    expect(html).toContain('View listing')
    expect(html).toContain('href="/listing/maker-example"')
    expect(html).toContain('/contact?topic=listing_claim')
    expect(html).toContain('No duplicate payment is needed.')
    expect(html).not.toContain('Pay &amp; publish')
    expect(html).not.toContain('Select package')
    expect(html).not.toContain('Email address')
    expect(html).not.toContain('You can still publish your listing now')
  })

  test('returning from Stripe immediately enters cancellation instead of offering the saved checkout again', async () => {
    const response = await fetch(`${BASE}/preview/${RESERVED_TOKEN}?checkout=cancelled`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('Cancelling secure checkout…')
    expect(html).toContain('Confirming with Stripe and releasing this website now.')
    expect(html).toContain('Featured')
    expect(html).toContain('maker@example.com')
    expect(html).toContain('Cancelling checkout…')
    expect(html).not.toContain('Resume secure checkout')
    expect(html).not.toContain('This website is already represented on LaunchLog.')
  })

  test('the contact page renders a real prefilled ownership form', async () => {
    const response = await fetch(`${BASE}/contact?topic=listing_claim&website=https%3A%2F%2Fmaker.example`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('Send a request')
    expect(html).toContain('Claim a listing')
    expect(html).toContain('value="https://maker.example"')
    expect(html).toContain('No automated ownership transfers.')
  })
})
