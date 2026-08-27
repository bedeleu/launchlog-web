import { describe, expect, test } from 'bun:test'
import { checkoutReleaseCopy } from './checkout-release-state'

describe('checkout release terminal copy', () => {
  test('never announces publication before webhook conversion', () => {
    for (const state of ['waiting', 'expired', 'timeout', 'unverifiable'] as const) {
      const copy = checkoutReleaseCopy(state)
      expect(copy.marker).not.toBe('Publication confirmed')
      expect(`${copy.title} ${copy.description}`).not.toContain('listing is live')
    }
  })

  test('reserves the live claim for a converted preview with a public slug', () => {
    const copy = checkoutReleaseCopy('converted')
    expect(copy.title).toBe('The listing is live in the catalog')
    expect(copy.marker).toBe('Publication confirmed')
    expect(copy.tone).toBe('success')
  })

  test('keeps every controlled failure factual and recoverable', () => {
    expect(checkoutReleaseCopy('expired').description).toContain('If payment completed')
    expect(checkoutReleaseCopy('timeout').description).toContain('Nothing has been marked failed')
    expect(checkoutReleaseCopy('unverifiable').description).toContain('Stripe receipt')
  })
})
