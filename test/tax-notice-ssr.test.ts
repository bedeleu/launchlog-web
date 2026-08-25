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
 * The tax notice is one accountant-owned sentence that must read identically on every surface that
 * mentions price. A build-time check cannot prove that: the value arrives through runtime config,
 * so only a rendered response shows whether all three pages agree — and whether an unset variable
 * publishes nothing rather than a guessed tax treatment.
 */
const NOTICE = 'SSR probe: prices are in US dollars and are the total amount charged.'
const PAGES = ['/pricing', '/help', '/terms'] as const

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

function spawnServer(port: number, taxNotice: string): ReturnType<typeof Bun.spawn> {
  return Bun.spawn({
    cmd: ['node', serverEntry],
    env: {
      ...process.env,
      PORT: String(port),
      NITRO_PORT: String(port),
      NUXT_PUBLIC_TAX_NOTICE: taxNotice,
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
    server = spawnServer(port, NOTICE)
    await waitForServer(base)
  })

  afterAll(() => {
    server?.kill()
  })

  test.each(PAGES)('%s renders the exact configured notice', async (path) => {
    expect(await renderedText(base, path)).toContain(NOTICE)
  })

  test('all three pages carry the same single sentence', async () => {
    const found = await Promise.all(
      PAGES.map(async path => (await renderedText(base, path)).includes(NOTICE)),
    )

    expect(found).toEqual([true, true, true])
  })

  test('the Terms JSON-LD reports the date the tax clause was added', async () => {
    const html = await (await fetch(`${base}/terms`)).text()

    expect(html).toContain('"dateModified":"2026-08-25"')
  })
})

describe.skipIf(!isBuilt)('tax notice is absent when the variable is empty', () => {
  const port = 3298
  const base = `http://127.0.0.1:${port}`
  let server: ReturnType<typeof Bun.spawn> | undefined

  beforeAll(async () => {
    server = spawnServer(port, '')
    await waitForServer(base)
  })

  afterAll(() => {
    server?.kill()
  })

  test.each(PAGES)('%s publishes no tax sentence at all', async (path) => {
    const text = await renderedText(base, path)

    expect(text).not.toContain(NOTICE)
    // No fallback may guess a tax treatment in the application's own words.
    expect(text).not.toMatch(/no tax is added/i)
    expect(text).not.toMatch(/tax is (?:not )?included/i)
  })

  test('/pricing keeps rendering without the notice block', async () => {
    const text = await renderedText(base, '/pricing')

    expect(text).toContain('7-day guarantee')
    expect(text).not.toContain('>\n              Tax\n')
  })
})
