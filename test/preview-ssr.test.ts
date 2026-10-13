import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import type { Preview } from '../app/composables/usePreviews'

const serverEntry = fileURLToPath(new URL('../.output/server/index.mjs', import.meta.url))
const previewPage = readFileSync(fileURLToPath(new URL('../app/pages/preview/[token].vue', import.meta.url)), 'utf8')
const isBuilt = existsSync(serverEntry)

if (!isBuilt && process.env.SSR_TESTS === 'required') {
  throw new Error(`SSR_TESTS=required but ${serverEntry} is missing — run "bun run build" first`)
}

const GENERATING_TOKEN = 'g'.repeat(64)
const CONFLICT_TOKEN = 'c'.repeat(64)
const RESERVED_TOKEN = 'r'.repeat(64)
const READY_TOKEN = 'p'.repeat(64)
const SNAPSHOT_PATH = `https://cdn.launchlog.ai/snapshots/${'a'.repeat(40)}`

const preview = (status: 'generating' | 'failed'): Preview => ({
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
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
})

const readyPreview: Preview = {
  ...preview('failed'),
  token: READY_TOKEN,
  status: 'ready',
  title: 'Maker Studio',
  tagline: 'A calm workspace for shipping small products.',
  description: 'Maker Studio brings product notes, release checklists, and launch assets together.\n\nKeep every release ready to share from one workspace.',
  screenshot_url: `${SNAPSHOT_PATH}/thumb.webp?v=123`,
  error_code: null,
  error_message: null,
  existing_listing: null,
}

const reservedPreview: Preview = {
  ...readyPreview,
  token: RESERVED_TOKEN,
  title: 'Reserved maker',
  tagline: 'A saved checkout.',
  email: 'maker@example.com',
  tier: 'featured',
  checkout_reserved: true,
}

let api: ReturnType<typeof Bun.serve> | undefined
let server: ReturnType<typeof Bun.spawn> | undefined
let base = ''

describe('preview release flow source contract', () => {
  test('keeps one set of publishing controls around the tabbed preview in mobile reading order', () => {
    const surfaces = ['data-preview-plan-choice', 'data-preview-tabs', 'data-preview-publishing-details']
      .map(marker => previewPage.indexOf(marker))

    expect(surfaces.every(index => index >= 0)).toBeTrue()
    expect(surfaces).toEqual([...surfaces].sort((a, b) => a - b))
    expect(previewPage.match(/<IntakePlanSelector\b/g) ?? []).toHaveLength(1)
    expect(previewPage.match(/id="a-email"/g) ?? []).toHaveLength(1)
    expect(previewPage.match(/@click="payAndPublish"/g) ?? []).toHaveLength(1)
  })

  test('the first action reveals publishing choices instead of starting a payment', () => {
    const publishToggle = previewPage.match(/<Button\b[^>]*data-preview-publish-toggle[^>]*>/)?.[0] ?? ''
    const revealAction = previewPage.match(/const revealPublishing = async \(\) => \{([\s\S]*?)\n\}/)?.[1] ?? ''

    expect(publishToggle).toContain('@click="revealPublishing"')
    expect(publishToggle).toContain(':aria-expanded="showPublishing"')
    expect(publishToggle).toContain('aria-controls="preview-publishing"')
    expect(revealAction).toContain('showPublishing.value = true')
    expect(revealAction).not.toMatch(/createSession|payAndPublish|publishAdminPreview|updatePreview/)
    expect(previewPage.match(/@click="payAndPublish"/g) ?? []).toHaveLength(1)
  })
})

const renderedMarkup = (html: string): string => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
const publishingSection = (html: string): string => html.match(/<section\b[^>]*\bid="preview-publishing"[^>]*>/)?.[0] ?? ''
const attribute = (tag: string, name: string): string => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? ''
const isHidden = (tag: string): boolean => /style="[^"]*display:\s*none|\shidden(?:=|\s|>)/.test(tag)

function expectDirectoryWorkspace(html: string): void {
  const publishing = publishingSection(html)
  const tabs = [...html.matchAll(/(<button\b[^>]*\brole="tab"[^>]*>)([\s\S]*?)<\/button>/g)]
  const directoryTab = tabs.find(tab => tab[2]?.includes('Directory placement'))?.[1] ?? ''
  const productTab = tabs.find(tab => tab[2]?.includes('Product page'))?.[1] ?? ''
  const directoryPanel = html.match(/<[^>]+\bdata-preview-panel="directory"[^>]*>/)?.[0] ?? ''
  const productPanel = html.match(/<[^>]+\bdata-preview-panel="product"[^>]*>/)?.[0] ?? ''

  expect(publishing).toContain('data-preview-workspace')
  expect(isHidden(publishing)).toBeFalse()
  expect(html).toContain('role="tablist"')
  expect(html).toContain('aria-label="Preview views"')
  expect(tabs).toHaveLength(2)
  expect(directoryTab).toContain('role="tab"')
  expect(directoryTab).toContain('aria-selected="true"')
  expect(productTab).toContain('role="tab"')
  expect(productTab).toContain('aria-selected="false"')
  expect(directoryPanel).toContain('role="tabpanel"')
  expect(attribute(directoryPanel, 'aria-labelledby')).toBe(attribute(directoryTab, 'id'))
  expect(isHidden(directoryPanel)).toBeFalse()
  expect(productPanel).toContain('role="tabpanel"')
  expect(attribute(productPanel, 'aria-labelledby')).toBe(attribute(productTab, 'id'))
  expect(isHidden(productPanel)).toBeTrue()
  for (const [tab, panel] of [[directoryTab, directoryPanel], [productTab, productPanel]]) {
    const controls = attribute(tab!, 'aria-controls')
    if (controls) expect(controls).toBe(attribute(panel!, 'id'))
  }
  expect(html.match(/<h1\b/g) ?? []).toHaveLength(1)
  expect(html.match(/data-payment-docket/g) ?? []).toHaveLength(1)
  expect(html.match(/id="workspace-product-about-title"/g) ?? []).toHaveLength(1)
  expect(html).not.toContain('id="preview-about-title"')
  expect(html).not.toContain('data-preview-publish-toggle')
  for (const tag of [directoryTab, productTab, directoryPanel, productPanel]) {
    const id = attribute(tag, 'id')
    expect(id).not.toBe('')
    expect(html.split(` id="${id}"`)).toHaveLength(2)
  }
}

function expectPrivatePreview(response: Response): void {
  expect(response.status).toBe(200)
  expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('referrer-policy')).toBe('no-referrer')
}

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
        if (request.method !== 'GET') return Response.json({ message: 'read-only SSR fixture' }, { status: 405 })
        if (path.endsWith(GENERATING_TOKEN)) return Response.json({ data: preview('generating') })
        if (path.endsWith(CONFLICT_TOKEN)) return Response.json({ data: preview('failed') })
        if (path.endsWith(RESERVED_TOKEN)) return Response.json({ data: reservedPreview })
        if (path.endsWith(READY_TOKEN)) return Response.json({ data: readyPreview })
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

  test('a ready preview leads with the real product and a large capture while publishing choices stay collapsed', async () => {
    const response = await fetch(`${base}/preview/${READY_TOKEN}`)
    const html = renderedMarkup(await response.text())
    const showcase = html.match(/<article\b[^>]*data-preview-showcase[^>]*>[\s\S]*?<\/article>/)?.[0] ?? ''
    const publishToggle = showcase.match(/<button\b[^>]*data-preview-publish-toggle[^>]*>/)?.[0] ?? ''
    const publishing = publishingSection(html)

    expectPrivatePreview(response)
    expect(showcase).toMatch(/<h1\b[^>]*>\s*Maker Studio\s*<\/h1>/)
    expect(showcase).toContain(readyPreview.tagline!)
    for (const paragraph of readyPreview.description!.split('\n\n')) expect(showcase).toContain(paragraph)
    expect(showcase).toContain(`src="${SNAPSHOT_PATH}/featured.webp?v=123"`)
    expect(showcase).toContain('alt="Maker Studio website screenshot"')
    expect(showcase).toContain('href="https://maker.example/"')
    expect(showcase).toContain('Private preview · not published')
    expect(showcase).toContain('Choose placement')
    expect(showcase).toContain('From $24.99/year')
    expect(publishToggle).toContain('aria-expanded="false"')
    expect(publishToggle).toContain('aria-controls="preview-publishing"')
    expect(publishing).not.toBe('')
    expect(isHidden(publishing)).toBeTrue()
    expect(publishing).toContain('data-preview-workspace')
    expect(html.match(/data-preview-showcase/g) ?? []).toHaveLength(1)
    expect(html.match(/<h1\b/g) ?? []).toHaveLength(1)
    expect(html).toContain('id="preview-about-title"')
    expect(html).not.toContain('data-preview-tabs')
    expect(html).not.toContain('id="workspace-product-about-title"')
    expect(showcase).not.toContain('data-payment-docket')
  })

  test('generation keeps the real product surface visible instead of a blank skeleton', async () => {
    const response = await fetch(`${base}/preview/${GENERATING_TOKEN}`)
    const html = renderedMarkup(await response.text())
    const publishToggle = html.match(/<button\b[^>]*data-preview-publish-toggle[^>]*>/)?.[0] ?? ''

    expectPrivatePreview(response)
    expect(html).toContain('Private release recorder')
    expect(html).toContain('Reading the website')
    expect(html).toContain('Validate')
    expect(html).toContain('Ready')
    expect(html).toContain('aria-current="step"')
    expect(html).toContain('>Current</span>')
    expect(html).toContain('>Complete</span>')
    expect(html).toContain('maker.example')
    expect(html).toContain('data-preview-showcase')
    expect(html).toContain('Your product page is taking shape.')
    expect(html).toContain('Preparing your website screenshot')
    expect(html).toContain('Preparing your page…')
    expect(publishToggle).toContain('disabled')
    expect(isHidden(publishingSection(html))).toBeTrue()
    expect(html).not.toContain('data-preview-editor')
  })

  test('a represented domain has ownership actions and no payment action', async () => {
    const response = await fetch(`${base}/preview/${CONFLICT_TOKEN}`)
    const html = renderedMarkup(await response.text())

    expectPrivatePreview(response)
    expect(html).toContain('Release already cataloged')
    expect(html).toContain('Request ownership')
    expect(html).toContain('View listing')
    expect(html).toContain('href="/listing/maker-example"')
    expect(html).toContain('/contact?topic=listing_claim')
    expect(html).toContain('No duplicate payment is needed.')
    expect(html).not.toContain('data-preview-publish-toggle')
    expect(html).not.toContain('data-preview-editor')
    expect(html).not.toContain('data-preview-tabs')
    const publishing = publishingSection(html)
    expect(publishing).not.toBe('')
    expect(isHidden(publishing)).toBeTrue()
  })

  test('an active reservation exposes the saved checkout and its original plan without another reveal step', async () => {
    const response = await fetch(`${base}/preview/${RESERVED_TOKEN}`)
    const html = renderedMarkup(await response.text())

    expectPrivatePreview(response)
    expectDirectoryWorkspace(html)
    expect(html).toContain('Your secure checkout is ready to resume')
    expect(html).toContain('Featured')
    expect(html).toContain('maker@example.com')
    expect(html).toContain('This plan is locked to your saved Stripe checkout')
    expect(html).not.toContain('Cancelling secure checkout…')
  })

  test('returning from Stripe immediately enters cancellation instead of offering the saved checkout again', async () => {
    const response = await fetch(`${base}/preview/${RESERVED_TOKEN}?checkout=cancelled`)
    const html = renderedMarkup(await response.text())

    expectPrivatePreview(response)
    expectDirectoryWorkspace(html)
    expect(html).toContain('Cancelling secure checkout…')
    expect(html).toContain('Confirming with Stripe and releasing this website now.')
    expect(html).toContain('Featured')
    expect(html).toContain('Cancelling checkout…')
    expect(html).not.toContain('Your secure checkout is ready to resume')
    expect(html).not.toContain('This website is already represented on LaunchLog.')
  })

  test('a cancellation return opens recovery even when the server reservation is already gone', async () => {
    const response = await fetch(`${base}/preview/${READY_TOKEN}?checkout=cancelled`)
    const html = renderedMarkup(await response.text())

    expectPrivatePreview(response)
    expectDirectoryWorkspace(html)
    expect(html).toContain('Cancelling secure checkout…')
    expect(html).toContain('Confirming with Stripe and releasing this website now.')
    expect(html).toContain('Cancelling checkout…')
    expect(html).not.toContain('Your secure checkout is ready to resume')
    expect(html).not.toContain('This plan is locked to your saved Stripe checkout')
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
