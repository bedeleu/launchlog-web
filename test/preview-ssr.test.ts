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
const READY_TOKEN = 'q'.repeat(64)

const checkoutCapability = {
  schema_version: '1',
  capability_version: '2026-08-29.1',
  capability_sha256: 'a'.repeat(64),
  checkout_enabled: true,
  provider: {
    legal_name: 'AB SOLUTIONS S.R.L.',
    legal_address: 'Registered office pending final ONRC verification, 300369 Timișoara, Romania',
    registration_id: 'J35/1784/2023',
    tax_id: '48116710',
    phone: '+40 000 000 000',
    email: 'legal@launchlog.ai',
  },
  provider_sha256: 'b'.repeat(64),
  offers: Object.fromEntries(['basic', 'featured'].map((tier, index) => [tier, {
    tier,
    name: index === 0 ? 'Standard' : 'Featured',
    amount_minor: index === 0 ? 2499 : 9900,
    currency: 'USD',
    interval: 'year',
    interval_count: 1,
    quantity: 1,
    stripe_price_id: `price_${tier}`,
    stripe_price_tax_behavior: 'exclusive',
    automatic_tax_enabled: false,
    notices: {
      en: {
        tax: 'Taxes are calculated and disclosed before payment.',
        renewal: 'Renews every 12 months until cancelled.',
        cancellation: 'Cancel before the next renewal date.',
        voluntary_refund: 'A voluntary 14-day refund policy applies.',
      },
      ro: {
        tax: 'Taxele sunt calculate și afișate înainte de plată.',
        renewal: 'Se reînnoiește la fiecare 12 luni până la anulare.',
        cancellation: 'Anulați înainte de următoarea dată de reînnoire.',
        voluntary_refund: 'Se aplică o politică voluntară de rambursare de 14 zile.',
      },
    },
  }])),
  offer_catalog_sha256: 'c'.repeat(64),
  legal: {
    terms_version: '2026-08-29',
    performance_notice_version: '2026-08-29',
    locales: {
      en: {
        url: 'https://launchlog.ai/terms',
        document: 'Exact English Terms snapshot served by the API.',
        document_sha256: 'd'.repeat(64),
        acceptance_text: 'I accept the exact English Terms displayed above.',
        performance_request_text: 'I request that the listing service begin immediately.',
      },
      ro: {
        url: 'https://launchlog.ai/ro/terms',
        document: 'Copia exactă în limba română furnizată de API.',
        document_sha256: 'e'.repeat(64),
        acceptance_text: 'Accept Termenii exacți în limba română afișați mai sus.',
        performance_request_text: 'Solicit începerea imediată a serviciului de listare.',
      },
    },
  },
}

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

const readyPreview = {
  ...reservedPreview,
  token: READY_TOKEN,
  title: 'Ready maker',
  tagline: 'A checkout-ready listing.',
  tier: null,
  email: null,
  checkout_reserved: false,
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
        if (path === '/api/v1/checkout/capability') return Response.json({ data: checkoutCapability })
        if (path.endsWith(GENERATING_TOKEN)) return Response.json({ data: preview('generating') })
        if (path.endsWith(CONFLICT_TOKEN)) return Response.json({ data: preview('failed') })
        if (path.endsWith(RESERVED_TOKEN)) return Response.json({ data: reservedPreview })
        if (path.endsWith(READY_TOKEN)) return Response.json({ data: readyPreview })
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

  test('a ready checkout is SSR-rendered from the complete server-authoritative legal snapshot', async () => {
    const response = await fetch(`${BASE}/preview/${READY_TOKEN}`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('Your order before Stripe')
    expect(html).toContain('AB SOLUTIONS S.R.L.')
    expect(html).toContain('J35/1784/2023')
    expect(html).toContain('48116710')
    expect(html).toContain('USD\u00a024.99')
    expect(html).toContain('Taxes are calculated and disclosed before payment.')
    expect(html).toContain('Renews every 12 months until cancelled.')
    expect(html).toContain('I accept the exact English Terms displayed above.')
    expect(html).toContain('I request that the listing service begin immediately.')
    expect(html).toContain('Exact English Terms snapshot served by the API.')
    expect(html).toContain('Read the exact accepted snapshot')
    expect(html).toContain('English')
    expect(html).toContain('Română')
    expect(html).not.toContain('IBAN')
    expect(html).not.toContain('SWIFT')
  })

  test('the contact page renders a real prefilled ownership form', async () => {
    const response = await fetch(`${BASE}/contact?topic=listing_claim&website=https%3A%2F%2Fmaker.example`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('Request file')
    expect(html).toContain('Send request')
    expect(html).toContain('Claim a listing')
    expect(html).toContain('value="https://maker.example"')
    expect(html).toContain('No automated ownership transfers.')
  })
})
