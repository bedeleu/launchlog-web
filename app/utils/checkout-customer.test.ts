import { describe, expect, test } from 'bun:test'
import { resolveCheckoutEmail } from './checkout-customer'

describe('resolveCheckoutEmail', () => {
  test('uses the authenticated account even when a stale draft contains another address', () => {
    expect(resolveCheckoutEmail('owner@example.com', 'stale@example.net')).toBe('owner@example.com')
  })

  test('uses the entered address for a guest checkout', () => {
    expect(resolveCheckoutEmail(null, '  guest@example.com  ')).toBe('guest@example.com')
  })

  test('normalizes whitespace around the authenticated address', () => {
    expect(resolveCheckoutEmail('  owner@example.com  ', 'guest@example.com')).toBe('owner@example.com')
  })
})
