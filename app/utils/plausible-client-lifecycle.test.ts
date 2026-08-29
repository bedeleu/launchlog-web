import { describe, expect, test } from 'bun:test'
import { resolvePlausibleCapability } from './plausible-privacy'
import { installPlausibleClientLifecycle } from './plausible-client-lifecycle'

const capability = resolvePlausibleCapability({
  enabled: true,
  domain: 'launchlog.ai',
  endpoint: 'https://plausible.launchlog.ai/api/event',
})!

const createHarness = (initiallyAllowed = false) => {
  const analyticsAllowed = { value: initiallyAllowed }
  const requests: Array<{ url: string, init: RequestInit }> = []
  const navigationHandlers: Array<(to: string, from: string, failure?: unknown) => void> = []
  const consentHandlers: Array<(allowed: boolean) => void> = []
  const mountedHandlers: Array<() => void> = []
  let currentPath = '/submit'
  let initializeCalls = 0
  let refreshCalls = 0
  let exposedSender: ((event: string, path?: string) => void) | undefined

  installPlausibleClientLifecycle({
    capability,
    browserOrigin: 'https://launchlog.ai',
    analyticsAllowed,
    initialize: () => { initializeCalls += 1 },
    refreshFromStorage: () => { refreshCalls += 1 },
    fetcher: async (url, init) => {
      requests.push({ url, init })
      return { ok: true }
    },
    currentPath: () => currentPath,
    exposeSender: sender => { exposedSender = sender },
    onConsentChange: handler => { consentHandlers.push(handler) },
    onNavigation: handler => { navigationHandlers.push(handler) },
    onMounted: handler => { mountedHandlers.push(handler) },
  })

  return {
    analyticsAllowed,
    requests,
    get initializeCalls() { return initializeCalls },
    get refreshCalls() { return refreshCalls },
    get exposedSender() { return exposedSender },
    mount: () => mountedHandlers.forEach(handler => handler()),
    setConsent: (allowed: boolean) => {
      analyticsAllowed.value = allowed
      consentHandlers.forEach(handler => handler(allowed))
    },
    navigate: (to: string, from = currentPath, failure?: unknown) => {
      currentPath = to
      navigationHandlers.forEach(handler => handler(to, from, failure))
    },
  }
}

describe('Plausible client lifecycle', () => {
  test('makes zero requests before consent and sends one initial pageview for stored consent', () => {
    const denied = createHarness(false)
    denied.mount()

    expect(denied.initializeCalls).toBe(1)
    expect(denied.requests).toHaveLength(0)
    expect(denied.exposedSender).toBeUndefined()

    const accepted = createHarness(true)
    accepted.mount()

    expect(accepted.requests).toHaveLength(1)
    expect(JSON.parse(String(accepted.requests[0]?.init.body))).toEqual({
      domain: 'launchlog.ai',
      name: 'pageview',
      url: 'https://launchlog.ai/submit',
    })
    expect(accepted.exposedSender).toBeFunction()
  })

  test('sends one pageview per eligible navigation and no duplicate or failed navigation', () => {
    const harness = createHarness(true)
    harness.mount()
    harness.navigate('/pricing')
    harness.navigate('/pricing#faq')
    harness.navigate('/pricing', '/pricing', new Error('aborted'))

    expect(harness.requests).toHaveLength(2)
    expect(JSON.parse(String(harness.requests[1]?.init.body))).toMatchObject({
      name: 'pageview',
      url: 'https://launchlog.ai/pricing',
    })
  })

  test('stops immediately after same-tab or cross-tab consent revocation', () => {
    const harness = createHarness(true)
    harness.mount()
    const initialSignal = harness.requests[0]?.init.signal

    harness.setConsent(false)
    expect(initialSignal?.aborted).toBe(true)
    expect(harness.exposedSender).toBeUndefined()

    harness.navigate('/pricing')
    expect(harness.requests).toHaveLength(1)

    harness.setConsent(true)
    expect(harness.requests).toHaveLength(2)
    harness.exposedSender?.('Preview Created', '/submit')
    expect(harness.requests).toHaveLength(3)

    // A storage event updates the shared consent ref and exercises the same watcher.
    harness.setConsent(false)
    harness.exposedSender?.('Checkout Started', '/submit')
    expect(harness.requests).toHaveLength(3)
    expect(harness.refreshCalls).toBeGreaterThan(0)
  })

  test('does not install hooks or transport for a mismatched browser origin', () => {
    const analyticsAllowed = { value: true }
    let initialized = false
    let hooked = false

    const installed = installPlausibleClientLifecycle({
      capability,
      browserOrigin: 'https://preview.launchlog.ai',
      analyticsAllowed,
      initialize: () => { initialized = true },
      refreshFromStorage: () => {},
      fetcher: async () => ({ ok: true }),
      currentPath: () => '/submit',
      exposeSender: () => {},
      onConsentChange: () => { hooked = true },
      onNavigation: () => { hooked = true },
      onMounted: () => { hooked = true },
    })

    expect(installed).toBe(false)
    expect(initialized).toBe(false)
    expect(hooked).toBe(false)
  })
})
