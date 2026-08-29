import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Same contract as the other SSR suites: these run against the real Nitro output, so they need a
// build. CI sets SSR_TESTS=required after the build step so the skip cannot hide a regression.
const serverEntry = fileURLToPath(new URL('../.output/server/index.mjs', import.meta.url))
const isBuilt = existsSync(serverEntry)

if (!isBuilt && process.env.SSR_TESTS === 'required') {
  throw new Error(`SSR_TESTS=required but ${serverEntry} is missing — run "bun run build" first`)
}

/**
 * The tax notice is accountant-owned and locale-specific. A build-time check cannot prove that the
 * correct locale reaches rendered output, so these assertions exercise the real Nitro artifact.
 */
const NOTICE_EN = 'SSR probe: English tax treatment approved by the accountant.'
const NOTICE_RO = 'Probă SSR: tratamentul fiscal în limba română aprobat de contabil.'
const EN_PAGES = ['/pricing', '/help', '/terms'] as const
const CONTENT_PAGES = [
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/cookies',
  '/dmca',
  '/help',
  '/seo-guide',
  '/api-docs',
  '/status',
] as const

async function waitForServer(base: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/robots.txt`)
      if (response.ok) return
    }
    catch {
      // not listening yet
    }

    await new Promise(resolve => setTimeout(resolve, 100))
  }

  throw new Error('Nitro server did not become ready in time')
}

function spawnServer(port: number, taxNoticeEn: string, taxNoticeRo: string): ReturnType<typeof Bun.spawn> {
  return Bun.spawn({
    cmd: ['node', serverEntry],
    env: {
      ...process.env,
      PORT: String(port),
      NITRO_PORT: String(port),
      NUXT_PUBLIC_TAX_NOTICE_EN: taxNoticeEn,
      NUXT_PUBLIC_TAX_NOTICE_RO: taxNoticeRo,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })
}

/** Server-rendered markup only: the assertion must not depend on hydration. */
async function renderedText(base: string, path: string): Promise<string> {
  const response = await fetch(`${base}${path}`)
  expect(response.status).toBe(200)

  const html = await response.text()

  return html.replace(/<script[\s\S]*?<\/script>/g, '')
}

describe.skipIf(!isBuilt)('tax notice is published identically when configured', () => {
  const port = 3297
  const base = `http://127.0.0.1:${port}`
  let server: ReturnType<typeof Bun.spawn> | undefined

  beforeAll(async () => {
    server = spawnServer(port, NOTICE_EN, NOTICE_RO)
    await waitForServer(base)
  })

  afterAll(() => {
    server?.kill()
  })

  test.each(EN_PAGES)('%s renders the exact English notice', async (path) => {
    const text = await renderedText(base, path)
    expect(text).toContain(NOTICE_EN)
    expect(text).not.toContain(NOTICE_RO)
  })

  test('all English commercial pages carry the same English sentence', async () => {
    const found = await Promise.all(
      EN_PAGES.map(async path => (await renderedText(base, path)).includes(NOTICE_EN)),
    )

    expect(found).toEqual([true, true, true])
  })

  test('/ro/terms renders only the separately approved Romanian notice', async () => {
    const text = await renderedText(base, '/ro/terms')
    expect(text).toContain(NOTICE_RO)
    expect(text).not.toContain(NOTICE_EN)
  })

  test('the Terms JSON-LD reports the latest legal revision date', async () => {
    const html = await (await fetch(`${base}/terms`)).text()

    expect(html).toContain('"dateModified":"2026-08-29"')
  })
})

describe.skipIf(!isBuilt)('tax notice is absent when the variable is empty', () => {
  const port = 3298
  const base = `http://127.0.0.1:${port}`
  let server: ReturnType<typeof Bun.spawn> | undefined

  beforeAll(async () => {
    server = spawnServer(port, '', '')
    await waitForServer(base)
  })

  afterAll(() => {
    server?.kill()
  })

  test.each([...EN_PAGES, '/ro/terms'] as const)('%s publishes no tax sentence at all', async (path) => {
    const text = await renderedText(base, path)

    expect(text).not.toContain(NOTICE_EN)
    expect(text).not.toContain(NOTICE_RO)
    // No fallback may guess a tax treatment in the application's own words.
    expect(text).not.toMatch(/no tax is added/i)
    expect(text).not.toMatch(/tax is (?:not )?included/i)
  })

  test('/pricing keeps rendering without the notice block', async () => {
    const response = await fetch(`${base}/pricing`)
    const html = await response.text()
    const text = html.replace(/<script[\s\S]*?<\/script>/g, '')

    expect(text).toContain('7-day guarantee')
    // Anchored to the block's own marker rather than to its source indentation:
    // the previous assertion matched a literal newline-and-fourteen-spaces and
    // would have passed vacuously after any re-indent.
    expect(html).not.toContain('data-tax-notice')
  })

  test('/pricing states the exact placement prices and billing period', async () => {
    const text = await renderedText(base, '/pricing')

    // The prices come from shared/constants/public-plans.ts. A redesign must not
    // re-literal them, and must not quietly change what a buyer is charged.
    expect(text).toContain('$24.99')
    expect(text).toContain('$99')
    expect(text).toContain('$2.08')
    expect(text).toContain('$8.25')
    expect(text).toContain('billed annually')
    expect(text).toContain('7-day money-back guarantee')
    // Premium is retired and no third edition may appear.
    expect(text).not.toContain('Premium')
    expect(text).not.toContain('$59.99')
    expect(text).not.toContain('$149')
  })

  test('/pricing sends each edition to its own checkout entry point', async () => {
    const html = await (await fetch(`${base}/pricing`)).text()

    expect(html).toContain('href="/submit?tier=basic"')
    expect(html).toContain('href="/submit?tier=featured"')
  })

  test('/pricing keeps the FAQ structured data matching the visible answers', async () => {
    const html = await (await fetch(`${base}/pricing`)).text()
    const text = html.replace(/<script[\s\S]*?<\/script>/g, '')
    const faqScript = html.match(/<script type="application\/ld\+json"[^>]*>(\{"@context":"https:\/\/schema\.org","@type":"FAQPage"[\s\S]*?)<\/script>/)

    expect(faqScript).not.toBeNull()
    const faq = JSON.parse(faqScript![1]!) as { mainEntity: Array<{ name: string, acceptedAnswer: { text: string } }> }

    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(7)
    for (const entry of faq.mainEntity) {
      expect(text).toContain(entry.name)
    }
    // Google requires the structured answers to be the visible ones.
    expect(text).toContain(faq.mainEntity[0]!.acceptedAnswer.text)
    // No unescaped angle bracket may reach the embedded graph.
    expect(faqScript![1]).not.toContain('<')
  })

  test('/pricing is composed from Release Catalog materials', async () => {
    const html = await (await fetch(`${base}/pricing`)).text()

    expect(html).toContain('border-release-seam')
    expect(html).toContain('bg-release-ink')
    expect(html).not.toContain('rounded-xl')
    expect(html).not.toContain('bg-white/[')
    expect(html).not.toContain('border-white/')
    expect(html).not.toContain('linear-gradient')
    expect(html).not.toMatch(/violet|purple|indigo|mauve/i)
  })

  test.each(CONTENT_PAGES)('%s uses the shared Release Catalog reading shell', async (path) => {
    const html = await (await fetch(`${base}${path}`)).text()
    const markup = html.replace(/<script[\s\S]*?<\/script>/g, '')

    expect(html).toContain('data-reading-shell')
    expect(markup.match(/<h1(?:\s|>)/g)?.length).toBe(1)
    expect(markup).toContain('border-release-seam')
    expect(markup).not.toContain('linear-gradient')
    expect(markup).not.toMatch(/violet|purple|indigo|mauve/i)
  })

  test('/contact exposes a stable accessible request state', async () => {
    const html = await (await fetch(`${base}/contact`)).text()

    expect(html).toContain('class="release-field')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Human approval required')
    expect(html).not.toContain('rounded-2xl')
  })
})
