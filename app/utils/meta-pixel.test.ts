import { describe, expect, test } from 'bun:test'
import {
  createMetaEventId,
  mapFunnelEventToMeta,
  resolveMetaPixelCapability,
  sanitizePublicMetaUrl,
} from './meta-pixel'

const enabled = {
  enabled: true,
  domain: 'launchlog.ai',
  pixelId: '123456789012345',
}

describe('Meta Pixel privacy capability', () => {
  test('accepts only an explicitly enabled numeric dataset on the production origin', () => {
    expect(resolveMetaPixelCapability(enabled)).toEqual({
      origin: 'https://launchlog.ai',
      pixelId: '123456789012345',
      scriptUrl: 'https://connect.facebook.net/en_US/fbevents.js',
    })
    expect(resolveMetaPixelCapability({ ...enabled, pixelId: 123456789012345 })).toEqual({
      origin: 'https://launchlog.ai',
      pixelId: '123456789012345',
      scriptUrl: 'https://connect.facebook.net/en_US/fbevents.js',
    })

    for (const input of [
      { ...enabled, enabled: false },
      { ...enabled, enabled: 'true' },
      { ...enabled, domain: 'preview.launchlog.ai' },
      { ...enabled, domain: 'LaunchLog.ai' },
      { ...enabled, pixelId: '' },
      { ...enabled, pixelId: '1234' },
      { ...enabled, pixelId: '12345<script>' },
    ]) {
      expect(resolveMetaPixelCapability(input)).toBeNull()
    }
  })

  test('tracks public pages without query data and rejects private or foreign URLs', () => {
    const capability = resolveMetaPixelCapability(enabled)!

    expect(sanitizePublicMetaUrl('/submit?fbclid=private-click&utm_source=meta', capability))
      .toBe('https://launchlog.ai/submit')
    expect(sanitizePublicMetaUrl('/listing/a-public-release?preview=secret', capability))
      .toBe('https://launchlog.ai/listing/a-public-release')
    expect(sanitizePublicMetaUrl('/preview/private-token', capability)).toBeNull()
    expect(sanitizePublicMetaUrl('/checkout/success?session_id=cs_secret', capability)).toBeNull()
    expect(sanitizePublicMetaUrl('https://example.com/submit', capability)).toBeNull()
  })

  test('maps the existing funnel to stable Meta event names', () => {
    expect(mapFunnelEventToMeta('Preview Created')).toEqual({ method: 'trackCustom', name: 'PreviewCreated' })
    expect(mapFunnelEventToMeta('Checkout Started')).toEqual({ method: 'track', name: 'InitiateCheckout' })
    expect(mapFunnelEventToMeta('Payment Canceled')).toEqual({ method: 'trackCustom', name: 'PaymentCanceled' })
    expect(mapFunnelEventToMeta('Listing Published')).toEqual({ method: 'trackCustom', name: 'ListingPublished' })
  })

  test('creates an opaque UUID event id without embedding product or account data', () => {
    const id = createMetaEventId(() => '123e4567-e89b-42d3-a456-426614174000')
    expect(id).toBe('123e4567-e89b-42d3-a456-426614174000')
  })
})
