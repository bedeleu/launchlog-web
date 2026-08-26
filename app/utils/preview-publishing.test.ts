import { describe, expect, test } from 'bun:test'
import { resolvePreviewPublishingMode } from './preview-publishing'

describe('preview publishing mode', () => {
  test('waits for Firebase claims before exposing any publishing action', () => {
    expect(resolvePreviewPublishingMode({
      authReady: false,
      isAdmin: false,
      checkoutReserved: false,
    })).toEqual({ kind: 'pending', cancelCheckout: false })
  })

  test('sends a normal account through checkout', () => {
    expect(resolvePreviewPublishingMode({
      authReady: true,
      isAdmin: false,
      checkoutReserved: false,
    })).toEqual({ kind: 'checkout', cancelCheckout: false })
  })

  test('publishes an admin placement without checkout', () => {
    expect(resolvePreviewPublishingMode({
      authReady: true,
      isAdmin: true,
      checkoutReserved: false,
    })).toEqual({ kind: 'admin', cancelCheckout: false })
  })

  test('requires an existing Stripe checkout to be cancelled before admin publishing', () => {
    expect(resolvePreviewPublishingMode({
      authReady: true,
      isAdmin: true,
      checkoutReserved: true,
    })).toEqual({ kind: 'admin', cancelCheckout: true })
  })
})
