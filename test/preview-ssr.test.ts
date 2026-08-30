import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'

const serverEntry = fileURLToPath(new URL('../.output/server/index.mjs', import.meta.url))
const previewPage = readFileSync(fileURLToPath(new URL('../app/pages/preview/[token].vue', import.meta.url)), 'utf8')
const isBuilt = existsSync(serverEntry)

if (!isBuilt && process.env.SSR_TESTS === 'required') {
  throw new Error(`SSR_TESTS=required but ${serverEntry} is missing — run "bun run build" first`)
}

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
let base = ''

describe('preview release flow source contract', () => {
  test('keeps the proof compact and the listing editor in the normal document flow', () => {
    expect(previewPage).not.toContain('xl:sticky xl:top-8')
    expect(previewPage.indexOf('<IntakePlacementPreview')).toBeLessThan(previewPage.indexOf('<IntakePreviewEditor'))
    expect(previewPage.indexOf('<IntakePreviewEditor')).toBeLessThan(previewPage.indexOf('<IntakePlanSelector'))
  })

  test('finishes the checkout rail with a compact payment docket', () => {
    const paymentActions = previewPage.match(/@click="payAndPublish"/g) ?? []

    expect(previewPage).toContain('03 — Publish')
    expect(previewPage).toContain('data-payment-docket')
    expect(previewPage).toContain('Payment docket')
    expect(previewPage).toContain('Total today')
    expect(previewPage).toContain('xl:grid-cols-[minmax(0,1fr)_minmax(18rem,20rem)_15rem]')
    expect(previewPage).toContain('class="xl:sticky xl:top-6"')
    expect(previewPage).not.toContain('space-y-6 xl:sticky')
    expect(previewPage.indexOf('02 — Publishing identity')).toBeLessThan(previewPage.indexOf('data-payment-docket'))
    expect(paymentActions).toHaveLength(1)
    expect(previewPage).toContain('Secure Stripe checkout')
    expect(previewPage).toContain('7-day money-back guarantee')
    expect(previewPage).toContain('data-checkout-return-status')
  })
})

async function waitForServer(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${base}/robots.txt`)).ok) return
    }
    catch {
      // not listening yet
    }
    await Bun.sleep(150)
  }
  throw new Error('Nitro server did not become ready in time')
}

async function availablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      if (!address || typeof address === 'string') {
        probe.close()
        reject(new Error('Could not reserve an SSR test port'))
        return
      }
      probe.close(error => error ? reject(error) : resolve(address.port))
    })
  })
}

describe.skipIf(!isBuilt)('preview and ownership-request SSR', () => {
  beforeAll(async () => {
    const apiPort = await availablePort()
    const serverPort = await availablePort()
    api = Bun.serve({
      port: apiPort,
      fetch(request) {
        const path = new URL(request.url).pathname
        if (path.endsWith(GENERATING_TOKEN)) return Response.json({ data: preview('generating') })
        if (path.endsWith(CONFLICT_TOKEN)) return Response.json({ data: preview('failed') })
        if (path.endsWith(RESERVED_TOKEN)) return Response.json({ data: reservedPreview })
        return Response.json({ message: 'not found' }, { status: 404 })
      },
    })
    base = `http://127.0.0.1:${serverPort}`

    server = Bun.spawn({
      cmd: ['node', serverEntry],
      env: {
        ...process.env,
        PORT: String(serverPort),
        NITRO_PORT: String(serverPort),
        NUXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
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
    const response = await fetch(`${base}/preview/${GENERATING_TOKEN}`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('Private release recorder')
    expect(html).toContain('Reading the website')
    expect(html).toContain('Validate')
    expect(html).toContain('Ready')
    expect(html).toContain('maker.example')
    expect(html).toContain('Your LaunchLog placement')
    expect(html).toContain('We’re reading your website details.')
    expect(html).toContain('data-preview-focus="true"')
    expect(html).toContain('ring-2 ring-release-paper ring-offset-2 ring-offset-release-rail')
    expect(html).toContain('opacity-25 grayscale blur-[1.5px]')
    expect(html).toContain('hidden sm:block')
    expect(html).toContain('hidden lg:block')
    expect(html).toContain('01 — Checking access')
    expect(html).toContain('Checking publishing access…')
    expect(html).not.toContain('Pay &amp; publish')
    expect(html).toContain('Preparing preview…')
    expect(html).toContain('Checkout unlocks automatically when the preview is ready.')
    expect(html).not.toContain('Generating your preview — capturing the screenshot and details')
    expect(html).not.toContain('Improve draft with AI')
  })

  test('a represented domain has ownership actions and no payment action', async () => {
    const response = await fetch(`${base}/preview/${CONFLICT_TOKEN}`)
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
    const response = await fetch(`${base}/preview/${RESERVED_TOKEN}?checkout=cancelled`)
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
    const response = await fetch(`${base}/contact?topic=listing_claim&website=https%3A%2F%2Fmaker.example`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('Request file')
    expect(html).toContain('Send request')
    expect(html).toContain('Claim a listing')
    expect(html).toContain('value="https://maker.example"')
    expect(html).toContain('No automated ownership transfers.')
  })
})
