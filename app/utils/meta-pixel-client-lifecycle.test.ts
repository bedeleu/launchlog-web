import { describe, expect, test } from 'bun:test'
import { resolveMetaPixelCapability } from './meta-pixel'
import { installMetaPixelClientLifecycle } from './meta-pixel-client-lifecycle'

const capability = resolveMetaPixelCapability({
  enabled: true,
  domain: 'launchlog.ai',
  pixelId: '123456789012345',
})!

const createHarness = (initiallyAllowed = false) => {
  const advertisingAllowed = { value: initiallyAllowed }
  const commands: unknown[][] = []
  const consentHandlers: Array<(allowed: boolean) => void> = []
  const navigationHandlers: Array<(to: string, from: string, failure?: unknown) => void> = []
  const mountedHandlers: Array<() => void> = []
  const loadedScripts: string[] = []
  const clearedCookies: string[] = []
  let currentPath = '/submit'
  let removedScripts = 0
  let initializeCalls = 0
  let exposedSender: ((event: 'Preview Created' | 'Checkout Started' | 'Payment Canceled' | 'Listing Published', eventId: string) => boolean) | undefined

  installMetaPixelClientLifecycle({
    capability,
    browserOrigin: 'https://launchlog.ai',
    advertisingAllowed,
    initialize: () => { initializeCalls += 1 },
    refreshFromStorage: () => {},
    currentPath: () => currentPath,
    command: (...args) => { commands.push(args) },
    loadScript: url => { loadedScripts.push(url) },
    removeScript: () => { removedScripts += 1 },
    clearCookie: name => { clearedCookies.push(name) },
    exposeEventSender: sender => { exposedSender = sender },
    onConsentChange: handler => { consentHandlers.push(handler) },
    onNavigation: handler => { navigationHandlers.push(handler) },
    onMounted: handler => { mountedHandlers.push(handler) },
  })

  return {
    advertisingAllowed,
    commands,
    loadedScripts,
    clearedCookies,
    get initializeCalls() { return initializeCalls },
    get removedScripts() { return removedScripts },
    get exposedSender() { return exposedSender },
    mount: () => mountedHandlers.forEach(handler => handler()),
    setConsent: (allowed: boolean) => {
      advertisingAllowed.value = allowed
      consentHandlers.forEach(handler => handler(allowed))
    },
    navigate: (to: string, from = currentPath, failure?: unknown) => {
      currentPath = to
      navigationHandlers.forEach(handler => handler(to, from, failure))
    },
  }
}

describe('Meta Pixel client lifecycle', () => {
  test('loads nothing before advertising consent and initializes once after opt-in', () => {
    const harness = createHarness(false)
    harness.mount()

    expect(harness.initializeCalls).toBe(1)
    expect(harness.loadedScripts).toEqual([])
    expect(harness.commands).toEqual([])
    expect(harness.exposedSender).toBeUndefined()

    harness.setConsent(true)
    expect(harness.loadedScripts).toEqual([capability.scriptUrl])
    expect(harness.commands).toEqual([
      ['consent', 'grant'],
      ['init', capability.pixelId],
      ['set', 'autoConfig', false, capability.pixelId],
      ['track', 'PageView'],
    ])
    expect(harness.exposedSender).toBeFunction()
  })

  test('tracks only eligible public navigation and public browser-side funnel events', () => {
    const harness = createHarness(true)
    harness.mount()
    harness.navigate('/pricing')
    harness.navigate('/pricing#faq')
    harness.navigate('/preview/private-token')
    harness.navigate('/pricing', '/pricing', new Error('aborted'))

    const eventId = '123e4567-e89b-42d3-a456-426614174000'
    harness.navigate('/submit')
    expect(harness.exposedSender?.('Preview Created', eventId)).toBe(true)
    harness.navigate('/checkout/success?session_id=cs_secret')
    expect(harness.exposedSender?.('Checkout Started', eventId)).toBe(false)

    expect(harness.commands.filter(command => command[1] === 'PageView')).toHaveLength(3)
    expect(harness.commands).toContainEqual([
      'trackCustom',
      'PreviewCreated',
      {},
      { eventID: eventId },
    ])
    expect(harness.commands.some(command => command[1] === 'InitiateCheckout')).toBe(false)
  })

  test('revokes immediately, removes the transport and expires Meta cookies', () => {
    const harness = createHarness(true)
    harness.mount()
    harness.setConsent(false)

    expect(harness.commands.at(-1)).toEqual(['consent', 'revoke'])
    expect(harness.removedScripts).toBe(1)
    expect(harness.clearedCookies).toEqual(['_fbp', '_fbc'])
    expect(harness.exposedSender).toBeUndefined()

    const commandCount = harness.commands.length
    harness.navigate('/pricing')
    expect(harness.commands).toHaveLength(commandCount)
  })

  test('does not install on a non-production browser origin', () => {
    let hooked = false
    const installed = installMetaPixelClientLifecycle({
      capability,
      browserOrigin: 'https://preview.launchlog.ai',
      advertisingAllowed: { value: true },
      initialize: () => { hooked = true },
      refreshFromStorage: () => {},
      currentPath: () => '/',
      command: () => {},
      loadScript: () => {},
      removeScript: () => {},
      clearCookie: () => {},
      exposeEventSender: () => {},
      onConsentChange: () => { hooked = true },
      onNavigation: () => { hooked = true },
      onMounted: () => { hooked = true },
    })

    expect(installed).toBe(false)
    expect(hooked).toBe(false)
  })
})
