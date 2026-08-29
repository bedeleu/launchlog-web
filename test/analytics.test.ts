import { afterEach, describe, expect, mock, test } from 'bun:test'
import { PRIVACY_CONSENT_STORAGE_KEY, createPrivacyConsent, serializePrivacyConsent } from '../app/utils/privacy-consent'
import { track } from '../app/utils/analytics'

// import.meta.client is true under bun's happy-path env for these units; the
// guard is exercised by asserting the queue receives the exact event name.
describe('track (Plausible funnel)', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  test('forwards only the exact event name and a query-free public URL after consent', () => {
    const spy = mock((_e: string, _options: { url: string }) => {})
    const accepted = serializePrivacyConsent(createPrivacyConsent(true, false, new Date(Date.now() - 1_000).toISOString()))
    ;(globalThis as { window?: unknown }).window = {
      plausible: spy,
      location: { origin: 'https://launchlog.ai' },
      localStorage: {
        getItem: (key: string) => key === PRIVACY_CONSENT_STORAGE_KEY ? accepted : null,
      },
    }

    track('Checkout Started')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]).toEqual(['Checkout Started', { url: 'https://launchlog.ai/submit' }])
  })

  test('is a no-op without consent or without the tracker', () => {
    const spy = mock((_e: string, _options: { url: string }) => {})
    ;(globalThis as { window?: unknown }).window = {
      plausible: spy,
      location: { origin: 'https://launchlog.ai' },
      localStorage: { getItem: () => null },
    }
    track('Preview Created')
    expect(spy).not.toHaveBeenCalled()

    ;(globalThis as { window?: unknown }).window = {}
    expect(() => track('Preview Created')).not.toThrow()
  })

  test('never lets an analytics failure break the funnel', () => {
    const accepted = serializePrivacyConsent(createPrivacyConsent(true, false, new Date(Date.now() - 1_000).toISOString()))
    ;(globalThis as { window?: unknown }).window = {
      plausible: () => { throw new Error('analytics unavailable') },
      location: { origin: 'https://launchlog.ai' },
      localStorage: { getItem: () => accepted },
    }

    expect(() => track('Listing Published')).not.toThrow()
  })

  test('sends one consented Meta event to the browser and server with the same event id', () => {
    const browserSpy = mock((_event: string, _eventId: string) => true)
    const fetchSpy = mock(async (_input: string, _init: RequestInit) => ({ ok: true }))
    const accepted = serializePrivacyConsent(createPrivacyConsent(false, true, new Date(Date.now() - 1_000).toISOString()))
    ;(globalThis as { window?: unknown }).window = {
      document: { cookie: '_fbp=fb.1.1724926530000.1234567890; _fbc=fb.1.1724926530000.AQz-safe_click-id' },
      fetch: fetchSpy,
      launchlogMetaEvent: browserSpy,
      location: { origin: 'https://launchlog.ai' },
      localStorage: {
        getItem: (key: string) => key === PRIVACY_CONSENT_STORAGE_KEY ? accepted : null,
      },
      navigator: { globalPrivacyControl: false },
      crypto: { randomUUID: () => '123e4567-e89b-42d3-a456-426614174000' },
    }

    track('Checkout Started')

    expect(browserSpy).toHaveBeenCalledWith('Checkout Started', '123e4567-e89b-42d3-a456-426614174000')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/api/meta-events')
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      keepalive: true,
      referrerPolicy: 'no-referrer',
      body: JSON.stringify({
        event: 'Checkout Started',
        eventId: '123e4567-e89b-42d3-a456-426614174000',
        advertisingConsent: true,
        fbp: 'fb.1.1724926530000.1234567890',
        fbc: 'fb.1.1724926530000.AQz-safe_click-id',
      }),
    })
  })

  test('does not send Meta events when GPC is active even if an old stored choice allowed ads', () => {
    const browserSpy = mock((_event: string, _eventId: string) => true)
    const fetchSpy = mock(async (_input: string, _init: RequestInit) => ({ ok: true }))
    const accepted = serializePrivacyConsent(createPrivacyConsent(false, true, new Date(Date.now() - 1_000).toISOString()))
    ;(globalThis as { window?: unknown }).window = {
      document: { cookie: '' },
      fetch: fetchSpy,
      launchlogMetaEvent: browserSpy,
      location: { origin: 'https://launchlog.ai' },
      localStorage: {
        getItem: (key: string) => key === PRIVACY_CONSENT_STORAGE_KEY ? accepted : null,
      },
      navigator: { globalPrivacyControl: true },
      crypto: { randomUUID: () => '123e4567-e89b-42d3-a456-426614174000' },
    }

    track('Preview Created')

    expect(browserSpy).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
