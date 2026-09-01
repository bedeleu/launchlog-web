import { describe, expect, test } from 'bun:test'
import {
  createApp,
  createError,
  eventHandler,
  send,
  setResponseHeaders,
  setResponseStatus,
  toNodeListener,
  toWebHandler,
} from 'h3'
import { createHooks } from 'hookable'
import { fetchNodeRequestHandler } from 'node-mock-http'
import type { NodeRequestHandler } from 'node-mock-http'
import type { NitroApp, NitroRuntimeHooks } from 'nitropack/types'
import discoveryErrorCachePlugin, {
  normalizeDiscoveryError,
  requiresPrivateErrorCache,
} from './discovery-error-cache'

const discoveryPaths = [
  ['/shipped'],
  ['/shipped/2026-w35'],
  ['/category/developer-tools'],
  ['/launch-channels'],
  ['/listing/tool'],
  ['/listing/tool/markdown'],
  ['/listing/tool/schema'],
  ['/llms.txt'],
  ['/llms-full.txt'],
] as const

describe('discovery error cache contract', () => {
  test.each([
    [404, 404],
    [410, 410],
    [500, 503],
    [502, 503],
  ] as const)('normalizes %i to a retry-safe %i response', (upstream, expected) => {
    expect(normalizeDiscoveryError({ statusCode: upstream })).toEqual({ statusCode: expected })
  })

  test('never exposes upstream error details', () => {
    expect(normalizeDiscoveryError({ statusCode: 500, message: 'private upstream body' }))
      .toEqual({ statusCode: 503 })
  })

  test.each(discoveryPaths)('%s requires private caching for every error receipt', (pathname) => {
    for (const status of [404, 410, 503] as const) {
      expect(requiresPrivateErrorCache(pathname, status)).toBeTrue()
    }
  })

  test.each(discoveryPaths)('%s leaves successful responses unchanged', (pathname) => {
    expect(requiresPrivateErrorCache(pathname, 200)).toBeFalse()
  })

  test('does not capture non-discovery errors', () => {
    expect(requiresPrivateErrorCache('/admin', 503)).toBeFalse()
  })

  test.each([
    ['/listing/tool/markdown', 404, 404, 'text/markdown; charset=utf-8', '# Listing not found', undefined, undefined, true],
    ['/listing/tool', 500, 503, 'text/markdown; charset=utf-8', '# Listing temporarily unavailable', 'Text/Markdown; q=0.5', 'Origin, Accept', false],
    ['/listing/tool', 500, 503, 'text/html; charset=utf-8', '<h1>LaunchLog temporarily unavailable</h1>', 'text/markdown; q=0', 'Origin, Accept', false],
    ['/llms.txt', 500, 503, 'text/plain; charset=utf-8', '# LaunchLog temporarily unavailable', undefined, undefined, false],
    ['/listing/tool/schema', 500, 503, 'application/ld+json; charset=utf-8', '"error":"Discovery temporarily unavailable"', undefined, undefined, true],
    ['/shipped/missing', 404, 404, 'text/html; charset=utf-8', '<h1>LaunchLog page not found</h1>', undefined, undefined, true],
    ['/shipped/withdrawn', 410, 410, 'text/html; charset=utf-8', '<h1>LaunchLog page withdrawn</h1>', undefined, undefined, true],
    ['/shipped', 500, 503, 'text/html; charset=utf-8', '<h1>LaunchLog temporarily unavailable</h1>', undefined, undefined, false],
    ['/shipped', 500, 503, 'text/markdown; charset=utf-8', '# Temporarily unavailable', 'text/markdown', 'Origin, Accept', false],
    ['/shipped/2026-w35', 404, 404, 'text/markdown; charset=utf-8', '# Not found', 'text/markdown', 'Origin, Accept', true],
  ] as const)('%s finishes escaped errors with a safe artifact response', async (
    pathname,
    thrownStatus,
    expectedStatus,
    contentType,
    safeBody,
    accept,
    expectedVary,
    shouldDeindex,
  ) => {
    const harness = createLifecycleHarness()
    harness.app.use(eventHandler((event) => {
      setResponseHeaders(event, {
        'Cache-Control': 'public, s-maxage=3600',
        'Content-Signal': 'ai-train=yes, search=yes, ai-input=yes',
        ...(expectedVary ? { Vary: 'Origin' } : {}),
      })
      throw createError({
        statusCode: thrownStatus,
        statusMessage: 'Private upstream status',
        message: 'private upstream body',
        data: { detail: 'private upstream data' },
      })
    }))

    const response = await harness.request(pathname, accept)
    const body = await response.text()

    expect(response.status).toBe(expectedStatus)
    expect(response.statusText).not.toContain('Private upstream')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('content-type')).toBe(contentType)
    expect(response.headers.get('x-robots-tag')).toBe(shouldDeindex ? 'noindex, nofollow' : null)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('content-security-policy')).toBe("script-src 'none'; frame-ancestors 'none';")
    expect(response.headers.get('content-signal')).toBeNull()
    if (expectedVary) expect(response.headers.get('vary')).toBe(expectedVary)
    expect(body).toContain(safeBody)
    expect(body).not.toContain('private upstream')
    if (contentType.startsWith('text/html')) {
      if (shouldDeindex) expect(body).toContain('<meta name="robots" content="noindex,nofollow">')
      else expect(body).not.toContain('<meta name="robots"')
      expect(body).toContain('background:#080907')
      expect(body).toContain('background:#11130f')
      expect(body).toContain('color:#e8e0cf')
      expect(body).toContain('color:#c9c0ae')
      expect(body).toContain('border-left:2px solid #e44c3f')
      expect(body).toContain('rgba(232,224,207,.18)')
      expect(body).not.toContain('#0a0e1a')
      expect(body).not.toContain('#111827')
      expect(body).not.toContain('border-radius')
      expect(body).not.toContain('box-shadow')
    }
    expect(harness.capturedErrors()).toBe(1)
    expect(harness.delegatedErrors()).toBe(0)
  })

  test('normalizes a Web-adapter thrown 500 before finalizing the discovery response', async () => {
    const harness = createLifecycleHarness()
    harness.app.use(eventHandler((event) => {
      setResponseHeaders(event, {
        'Cache-Control': 'public, s-maxage=3600',
        'Content-Signal': 'ai-train=yes, search=yes, ai-input=yes',
      })
      throw createError({
        statusCode: 500,
        message: 'private Web-adapter upstream body',
        data: { detail: 'private Web-adapter upstream data' },
      })
    }))

    const response = await harness.webRequest('/listing/tool/markdown')
    const body = await response.text()

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(response.headers.get('content-signal')).toBeNull()
    expect(body).toContain('# Listing temporarily unavailable')
    expect(body).not.toContain('private Web-adapter upstream')
    expect(harness.capturedErrors()).toBe(1)
    expect(harness.delegatedErrors()).toBe(0)
  })

  test('leaves a public 200 response unchanged after a recoverable captured error', async () => {
    const harness = createLifecycleHarness()
    harness.app.use(eventHandler(async (event) => {
      setResponseHeaders(event, { 'Cache-Control': 'public, s-maxage=3600' })
      await harness.hooks.callHook('error', new Error('recoverable telemetry'), { event })
      return 'successful discovery response'
    }))

    const response = await harness.request('/listing/tool')

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=3600')
    expect(await response.text()).toBe('successful discovery response')
    expect(harness.delegatedErrors()).toBe(0)
  })

  test('delegates escaped non-discovery errors to the original handler unchanged', async () => {
    const harness = createLifecycleHarness()
    harness.app.use(eventHandler(() => {
      throw createError({ statusCode: 500, message: 'original admin error' })
    }))

    const response = await harness.request('/admin')

    expect(response.status).toBe(500)
    expect(response.headers.get('cache-control')).toBe('no-cache')
    expect(response.headers.get('x-original-error')).toBe('yes')
    expect(await response.text()).toBe('{"error":"original admin error"}')
    expect(harness.capturedErrors()).toBe(1)
    expect(harness.delegatedErrors()).toBe(1)
  })

  test('keeps normally returned discovery errors private through beforeResponse', async () => {
    const harness = createLifecycleHarness()
    harness.app.use(eventHandler((event) => {
      setResponseStatus(event, 503)
      setResponseHeaders(event, { 'Cache-Control': 'public, s-maxage=3600' })
      return 'safe returned error'
    }))

    const response = await harness.request('/listing/tool')

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.text()).toBe('safe returned error')
  })
})

function createLifecycleHarness() {
  const hooks = createHooks<NitroRuntimeHooks>()
  let capturedErrorCount = 0
  let delegatedErrorCount = 0
  const captureError: NitroApp['captureError'] = () => {
    capturedErrorCount += 1
  }
  const app = createApp({
    onError: async (error, event) => {
      delegatedErrorCount += 1
      captureError(error, { event, tags: ['request'] })
      await hooks.callHook('error', error, { event })
      setResponseStatus(event, error.statusCode)
      setResponseHeaders(event, {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Original-Error': 'yes',
      })
      await send(event, JSON.stringify({ error: error.message }))
    },
    onBeforeResponse: (event, response) => hooks.callHook('beforeResponse', event, response),
  })

  discoveryErrorCachePlugin({ h3App: app, hooks, captureError } as unknown as NitroApp)
  const nodeHandler = toNodeListener(app) as unknown as NodeRequestHandler
  const webHandler = toWebHandler(app)

  return {
    app,
    hooks,
    capturedErrors: () => capturedErrorCount,
    delegatedErrors: () => delegatedErrorCount,
    webRequest: (pathname: string) => webHandler(new Request(`https://launchlog.ai${pathname}`)),
    request: (pathname: string, accept?: string) => fetchNodeRequestHandler(
      nodeHandler,
      `https://launchlog.ai${pathname}`,
      { headers: accept ? { accept } : undefined },
    ),
  }
}
