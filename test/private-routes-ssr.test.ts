import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Same contract as the blog SSR suite: these run against the real Nitro output, so they need a
// build. CI sets SSR_TESTS=required after the build step so the skip cannot hide a regression.
const serverEntry = fileURLToPath(new URL('../.output/server/index.mjs', import.meta.url))
const isBuilt = existsSync(serverEntry)

if (!isBuilt && process.env.SSR_TESTS === 'required') {
  throw new Error(`SSR_TESTS=required but ${serverEntry} is missing — run "bun run build" first`)
}

const SERVER_PORT = 3296
const BASE = `http://127.0.0.1:${SERVER_PORT}`

let server: ReturnType<typeof Bun.spawn> | undefined

async function waitForServer(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/robots.txt`)
      if (response.ok) return
    }
    catch {
      // not listening yet
    }

    await new Promise(resolve => setTimeout(resolve, 100))
  }

  throw new Error('Nitro server did not become ready in time')
}

function canonicalOf(html: string): string | null {
  return html.match(/<link[^>]+rel="canonical"[^>]*>/)?.[0].match(/href="([^"]+)"/)?.[1] ?? null
}

function robotsMetaOf(html: string): string | null {
  return html.match(/<meta[^>]+name="robots"[^>]*>/)?.[0].match(/content="([^"]*)"/)?.[1] ?? null
}

function isDeindexed(response: Response, html: string): boolean {
  const header = response.headers.get('x-robots-tag') ?? ''
  const meta = robotsMetaOf(html) ?? ''

  return /noindex/i.test(header) || /noindex/i.test(meta)
}

/**
 * The contract for a mis-cased URL: it may never be a live, indexable duplicate of the canonical
 * lowercase route. Either outcome is accepted — a deindexed 404, or a permanent redirect to the
 * canonical path with the query string intact.
 */
async function expectNoIndexableDuplicate(path: string): Promise<void> {
  const response = await fetch(`${BASE}${path}`, { redirect: 'manual' })

  if (response.status === 301 || response.status === 308) {
    const location = response.headers.get('location') ?? ''
    const [requestedPath, requestedQuery] = path.split('?')
    const [targetPath, targetQuery] = location.split('?')

    // Same resource, different casing: only the route segments are canonicalised. Parameter values
    // such as a preview token are case-sensitive credentials and are asserted separately.
    expect(targetPath!.toLowerCase()).toBe(requestedPath!.toLowerCase())
    expect(targetPath).not.toBe(requestedPath)
    expect(targetPath).toBe(targetPath!.replace(/^(\/[a-z]+)/i, match => match.toLowerCase()))
    if (requestedQuery) {
      expect(targetQuery).toBe(requestedQuery)
    }

    return
  }

  const html = await response.text()

  expect(response.status).toBe(404)
  expect(isDeindexed(response, html)).toBe(true)
  // A self-referential canonical on the mis-cased URL is what makes it an indexable duplicate.
  expect(canonicalOf(html) ?? '').not.toContain(path.split('?')[0]!)
}

describe.skipIf(!isBuilt)('excluded routes are immune to path casing', () => {
  beforeAll(async () => {
    server = Bun.spawn({
      cmd: ['node', serverEntry],
      env: {
        ...process.env,
        PORT: String(SERVER_PORT),
        NITRO_PORT: String(SERVER_PORT),
        // A closed port makes /blog fail upstream, which is the cheapest way to render a real
        // 503 through app/error.vue and assert it is NOT deindexed.
        NUXT_PUBLIC_WORDPRESS_BLOG_URL: 'http://127.0.0.1:1',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    await waitForServer()
  })

  afterAll(() => {
    server?.kill()
  })

  test('/admin stays the canonical route and is deindexed', async () => {
    const response = await fetch(`${BASE}/admin`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(isDeindexed(response, html)).toBe(true)
  })

  test('/admin/listings keeps its query string and stays deindexed', async () => {
    const response = await fetch(`${BASE}/admin/listings?status=published`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(isDeindexed(response, html)).toBe(true)
  })

  test('/admin/outreach is a private client-only tool', async () => {
    const response = await fetch(`${BASE}/admin/outreach`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(isDeindexed(response, html)).toBe(true)
  })

  // The advisory: route rules were silently dropped for mixed-case paths, so /Admin rendered a
  // live 200 with `index, follow` and a canonical pointing at itself.
  test('mis-cased admin routes are never indexable duplicates', async () => {
    for (const path of ['/Admin', '/aDmIn', '/ADMIN', '/Admin/listings?status=published', '/Admin/Outreach?source=manual']) {
      await expectNoIndexableDuplicate(path)
    }
  })

  test('/dashboard is deindexed and its mis-cased variants are not indexable duplicates', async () => {
    const response = await fetch(`${BASE}/dashboard`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(isDeindexed(response, html)).toBe(true)

    for (const path of ['/Dashboard', '/DASHBOARD']) {
      await expectNoIndexableDuplicate(path)
    }
  })

  test('/checkout/success is deindexed and its mis-cased variants are not indexable duplicates', async () => {
    const response = await fetch(`${BASE}/checkout/success`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(isDeindexed(response, html)).toBe(true)

    for (const path of ['/Checkout/success', '/checkout/Success', '/Checkout/Success']) {
      await expectNoIndexableDuplicate(path)
    }
  })

  // Preview tokens are case-sensitive credentials in the path. Hardening the casing of *route*
  // segments must not touch them.
  test('a preview token keeps its exact casing and still renders', async () => {
    const token = 'MiXeD-Case-Token'
    const response = await fetch(`${BASE}/preview/${token}`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(isDeindexed(response, html)).toBe(true)
    expect(canonicalOf(html) ?? '').toContain(`/preview/${token}`)
  })

  test('a mis-cased preview prefix is canonicalised without touching the token', async () => {
    const token = 'MiXeD-Case-Token'
    await expectNoIndexableDuplicate(`/Preview/${token}`)

    const response = await fetch(`${BASE}/Preview/${token}`, { redirect: 'manual' })

    // The route segment is lowercased; the credential after it must survive byte for byte.
    if (response.status === 301 || response.status === 308) {
      expect(response.headers.get('location')).toBe(`/preview/${token}`)
    }
  })

  test('a mis-cased private route keeps its query string across the redirect', async () => {
    const response = await fetch(`${BASE}/Admin/listings?status=published`, { redirect: 'manual' })

    if (response.status === 301 || response.status === 308) {
      expect(response.headers.get('location')).toBe('/admin/listings?status=published')
    }
    else {
      expect(response.status).toBe(404)
    }
  })

  test('a public route still works and stays indexable at its canonical casing', async () => {
    const response = await fetch(`${BASE}/about`)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(isDeindexed(response, html)).toBe(false)
    expect(canonicalOf(html)).toBe('https://launchlog.ai/about')
  })

  test('the public header links directly to Contact', async () => {
    const response = await fetch(`${BASE}/`)
    const html = await response.text()
    const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? ''

    expect(response.status).toBe(200)
    expect(header).toContain('href="/contact"')
    expect(header).toContain('>Contact</a>')
  })

  // Every public page had the same duplicate surface, not just the excluded ones.
  test('a mis-cased public route is not an indexable duplicate either', async () => {
    for (const path of ['/About', '/ABOUT']) {
      await expectNoIndexableDuplicate(path)
    }
  })

  test('an unmatched route is a deindexed 404', async () => {
    const response = await fetch(`${BASE}/definitely-not-a-route`, { headers: { accept: 'text/html' } })
    const html = await response.text()

    expect(response.status).toBe(404)
    expect(isDeindexed(response, html)).toBe(true)
  })

  // Nuxt renders error.vue in place of app.vue, so the document shell is not inherited. Without
  // it the page shipped a bare <html> and the white headline sat on the default light background.
  test('the error page carries the same document shell as the rest of the site', async () => {
    const response = await fetch(`${BASE}/About`, { headers: { accept: 'text/html' } })
    const html = await response.text()
    const htmlTag = html.match(/<html[^>]*>/)?.[0] ?? ''

    expect(response.status).toBe(404)
    expect(htmlTag).toContain('lang="en"')
    expect(htmlTag).toContain('class="dark"')
    // Text is only visible because the dark Release Catalog shell is applied; assert both halves together.
    expect(html).toContain('bg-release-ink')
    expect(html).toContain('Record unavailable')
    expect(isDeindexed(response, html)).toBe(true)
  })

  // A deindex directive on a temporary failure asks search engines to drop URLs that are live.
  // The blog upstream is pointed at a closed port for this suite, so /blog answers 503.
  test('a 503 is never deindexed', async () => {
    const response = await fetch(`${BASE}/blog`, { headers: { accept: 'text/html' } })
    const html = await response.text()

    expect(response.status).toBe(503)
    expect(response.headers.get('x-robots-tag')).toBeNull()
    expect(robotsMetaOf(html) ?? '').not.toContain('noindex')
    expect(isDeindexed(response, html)).toBe(false)
  })

  test('the 503 error page still renders the dark shell', async () => {
    const response = await fetch(`${BASE}/blog`, { headers: { accept: 'text/html' } })
    const htmlTag = (await response.text()).match(/<html[^>]*>/)?.[0] ?? ''

    expect(response.status).toBe(503)
    expect(htmlTag).toContain('lang="en"')
    expect(htmlTag).toContain('class="dark"')
  })
})
