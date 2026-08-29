import { afterEach, describe, expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
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
    const accepted = serializePrivacyConsent(createPrivacyConsent(true, new Date(Date.now() - 1_000).toISOString()))
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
    const accepted = serializePrivacyConsent(createPrivacyConsent(true, new Date(Date.now() - 1_000).toISOString()))
    ;(globalThis as { window?: unknown }).window = {
      plausible: () => { throw new Error('analytics unavailable') },
      location: { origin: 'https://launchlog.ai' },
      localStorage: { getItem: () => accepted },
    }

    expect(() => track('Listing Published')).not.toThrow()
  })

  test('qualifies Preview Created at the ready transition instead of the intake response', () => {
    const previews = readFileSync(fileURLToPath(new URL('../app/composables/usePreviews.ts', import.meta.url)), 'utf8')
    const page = readFileSync(fileURLToPath(new URL('../app/pages/preview/[token].vue', import.meta.url)), 'utf8')

    expect(previews).not.toContain("track('Preview Created')")
    expect(page).toContain('consumePreviewCreatedMeasurement(current)')
    expect(page).toContain("track('Preview Created')")
  })
})
