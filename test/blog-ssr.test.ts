import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// SSR tests run against the real Nitro output, so they need a build. `bun test` skips them when
// .output is absent; CI sets SSR_TESTS=required after the build step so the skip cannot hide.
const serverEntry = fileURLToPath(new URL('../.output/server/index.mjs', import.meta.url))
const isBuilt = existsSync(serverEntry)

if (!isBuilt && process.env.SSR_TESTS === 'required') {
  throw new Error(`SSR_TESTS=required but ${serverEntry} is missing — run "bun run build" first`)
}

const UPSTREAM_PORT = 3197
const SERVER_PORT = 3196
const BASE = `http://127.0.0.1:${SERVER_PORT}`

const CHALLENGE_BODY = '<html><head><title>One moment, please...</title></head><body>checking</body></html>'

const VALID_POST = {
  id: 171,
  date: '2026-08-15T09:00:00',
  modified: '2026-08-15T09:00:00',
  slug: 'a-published-article',
  link: 'https://blog.launchlog.ai/2026/08/15/a-published-article/',
  title: { rendered: 'A Published Article' },
  excerpt: { rendered: '<p>Excerpt.</p>' },
  content: { rendered: '<p>Body.</p>' },
}

type UpstreamMode = 'challenge' | 'empty' | 'posts'

let upstreamMode: UpstreamMode = 'challenge'
let upstream: ReturnType<typeof Bun.serve> | undefined
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

describe.skipIf(!isBuilt)('/blog SSR behaviour under upstream failure', () => {
  beforeAll(async () => {
    upstream = Bun.serve({
      port: UPSTREAM_PORT,
      fetch() {
        if (upstreamMode === 'challenge') {
          // The exact production failure: an anti-bot page served with HTTP 200 text/html.
          return new Response(CHALLENGE_BODY, { headers: { 'content-type': 'text/html' } })
        }

        const body = upstreamMode === 'empty' ? [] : [VALID_POST]

        return new Response(JSON.stringify(body), {
          headers: { 'content-type': 'application/json', 'x-wp-totalpages': '1' },
        })
      },
    })

    server = Bun.spawn({
      cmd: ['node', serverEntry],
      env: {
        ...process.env,
        PORT: String(SERVER_PORT),
        NITRO_PORT: String(SERVER_PORT),
        NUXT_PUBLIC_WORDPRESS_BLOG_URL: `http://127.0.0.1:${UPSTREAM_PORT}`,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    await waitForServer()
  })

  afterAll(() => {
    server?.kill()
    upstream?.stop(true)
  })

  test('an upstream challenge makes /blog answer 503 instead of a false empty state', async () => {
    upstreamMode = 'challenge'

    const response = await fetch(`${BASE}/blog`)
    const body = await response.text()

    expect(response.status).toBe(503)
    expect(body).not.toContain('No articles published yet')
  })

  test('an upstream challenge never marks /blog as indexable-empty', async () => {
    upstreamMode = 'challenge'

    const response = await fetch(`${BASE}/blog`)

    expect(response.status).toBe(503)
    expect(response.headers.get('x-robots-tag')).toBeNull()
  })

  test('a successful empty response is the only way to show the empty state', async () => {
    upstreamMode = 'empty'

    const response = await fetch(`${BASE}/blog`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('No articles published yet')
  })

  test('a successful response with posts renders them', async () => {
    upstreamMode = 'posts'

    const response = await fetch(`${BASE}/blog`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('/blog/a-published-article')
    expect(body).not.toContain('No articles published yet')
  })

  test('an upstream challenge makes a real post URL answer 503 without a deindex directive', async () => {
    upstreamMode = 'challenge'

    const response = await fetch(`${BASE}/blog/a-published-article`)
    const body = await response.text()

    expect(response.status).toBe(503)
    expect(response.headers.get('x-robots-tag')).toBeNull()
    expect(body).not.toContain('/blog/undefined')
    expect(body).not.toContain('Untitled')
  })

  test('a genuinely missing post still answers 404 with a deindex directive', async () => {
    upstreamMode = 'empty'

    const response = await fetch(`${BASE}/blog/no-such-post`)

    expect(response.status).toBe(404)
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })

  test('the upstream body never reaches a client response', async () => {
    upstreamMode = 'challenge'

    for (const path of ['/blog', '/blog/a-published-article', '/api/blog/posts']) {
      const body = await fetch(`${BASE}${path}`).then(response => response.text())

      expect(body).not.toContain('One moment')
      expect(body).not.toContain('checking')
    }
  })
})
