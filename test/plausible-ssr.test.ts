import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Self-hosted Plausible must render as a real <script> in the SSR <head> ONLY when
// NUXT_PUBLIC_PLAUSIBLE_SRC is set, and render nothing when it is empty (non-prod builds
// must stay analytics-free). useHead runs at setup, so only rendered output proves it.
const serverEntry = fileURLToPath(new URL('../.output/server/index.mjs', import.meta.url))
const isBuilt = existsSync(serverEntry)

if (!isBuilt && process.env.SSR_TESTS === 'required') {
  throw new Error(`SSR_TESTS=required but ${serverEntry} is missing — run "bun run build" first`)
}

const UPSTREAM_PORT = 3205
const ON_PORT = 3206
const OFF_PORT = 3207
const SCRIPT = 'https://plausible.launchlog.ai/js/pa-IO89ybsX-AH93y-xY_tHi.js'

const EMPTY_META = {
  current_page: 1, from: 0, last_page: 1, per_page: 30, to: 0, total: 0,
  slot_capacity: 30, slots_used: 0,
}

let upstream: ReturnType<typeof Bun.serve> | undefined
let onServer: ReturnType<typeof Bun.spawn> | undefined
let offServer: ReturnType<typeof Bun.spawn> | undefined

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

describe.skipIf(!isBuilt)('Plausible script injection (SSR)', () => {
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

    onServer = Bun.spawn({
      cmd: ['node', serverEntry],
      env: { ...baseEnv, PORT: String(ON_PORT), NUXT_PUBLIC_PLAUSIBLE_SRC: SCRIPT },
      stdout: 'ignore', stderr: 'ignore',
    })
    offServer = Bun.spawn({
      cmd: ['node', serverEntry],
      env: { ...baseEnv, PORT: String(OFF_PORT), NUXT_PUBLIC_PLAUSIBLE_SRC: '' },
      stdout: 'ignore', stderr: 'ignore',
    })

    await Promise.all([
      waitFor(`http://127.0.0.1:${ON_PORT}`),
      waitFor(`http://127.0.0.1:${OFF_PORT}`),
    ])
  })

  afterAll(() => {
    onServer?.kill()
    offServer?.kill()
    upstream?.stop(true)
  })

  test('renders the async Plausible script + init when NUXT_PUBLIC_PLAUSIBLE_SRC is set', async () => {
    const html = await fetch(`http://127.0.0.1:${ON_PORT}/`).then(r => r.text())

    expect(html).toContain(`src="${SCRIPT}"`)
    expect(html).toContain('plausible.init')
  })

  test('renders NO analytics script when NUXT_PUBLIC_PLAUSIBLE_SRC is empty', async () => {
    const html = await fetch(`http://127.0.0.1:${OFF_PORT}/`).then(r => r.text())

    expect(html).not.toContain('plausible.launchlog.ai')
    expect(html).not.toContain('plausible.init')
  })
})
