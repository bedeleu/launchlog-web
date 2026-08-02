import { describe, expect, test } from 'bun:test'
import { authMagicLinkUrl, resolveMagicLinkEmail, safeAuthRedirect } from './safe-redirect'

describe('safeAuthRedirect', () => {
  test('keeps dashboard destinations on LaunchLog', () => {
    expect(safeAuthRedirect('/dashboard')).toBe('/dashboard')
    expect(safeAuthRedirect('/dashboard?listing=listing-1')).toBe('/dashboard?listing=listing-1')
    expect(safeAuthRedirect('/dashboard/listings/listing-1/receipt#checks')).toBe('/dashboard/listings/listing-1/receipt#checks')
  })

  test('falls back for external, protocol-relative, malformed, and admin destinations', () => {
    expect(safeAuthRedirect('https://evil.test/dashboard')).toBe('/dashboard')
    expect(safeAuthRedirect('//evil.test/dashboard')).toBe('/dashboard')
    expect(safeAuthRedirect('/\\evil.test/dashboard')).toBe('/dashboard')
    expect(safeAuthRedirect('/admin/listings')).toBe('/dashboard')
    expect(safeAuthRedirect('dashboard')).toBe('/dashboard')
    expect(safeAuthRedirect(null)).toBe('/dashboard')
  })
})

test('keeps the safe dashboard destination in the passwordless continuation URL', () => {
  expect(authMagicLinkUrl('https://launchlog.ai', '/dashboard/listings/listing-1/receipt'))
    .toBe('https://launchlog.ai/login?magic=1&redirect=%2Fdashboard%2Flistings%2Flisting-1%2Freceipt')
  expect(authMagicLinkUrl('https://launchlog.ai', 'https://evil.test'))
    .toBe('https://launchlog.ai/login?magic=1&redirect=%2Fdashboard')
})

test('resolves a cross-device magic link from branded email confirmation', () => {
  expect(resolveMagicLinkEmail(null, '  maker@example.com  ')).toBe('maker@example.com')
  expect(resolveMagicLinkEmail('stored@example.com', 'other@example.com')).toBe('other@example.com')
  expect(resolveMagicLinkEmail('stored@example.com')).toBe('stored@example.com')
  expect(resolveMagicLinkEmail(null, '   ')).toBeNull()
  expect(resolveMagicLinkEmail(null, undefined)).toBeNull()
})
