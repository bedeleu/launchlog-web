import { describe, expect, test } from 'bun:test'
import { authMagicLinkUrl, resolveMagicLinkEmail, safeAuthRedirect } from './safe-redirect'

describe('safeAuthRedirect', () => {
  test('keeps dashboard destinations on LaunchLog', () => {
    expect(safeAuthRedirect('/dashboard')).toBe('/dashboard')
    expect(safeAuthRedirect('/dashboard?listing=listing-1')).toBe('/dashboard?listing=listing-1')
    expect(safeAuthRedirect('/dashboard/listings/listing-1/receipt#checks')).toBe('/dashboard/listings/listing-1/receipt#checks')
    expect(safeAuthRedirect('/dashboard/search?q=founder%40example.com#results')).toBe('/dashboard/search?q=founder%40example.com#results')
  })

  test('accepts exact admin auth destinations', () => {
    expect(safeAuthRedirect('/admin')).toBe('/admin')
    expect(safeAuthRedirect('/admin/')).toBe('/admin/')
    expect(safeAuthRedirect('/admin/outreach/candidates?status=failed#review')).toBe('/admin/outreach/candidates?status=failed#review')
    expect(safeAuthRedirect('/admin/outreach?q=founder%40example.com')).toBe('/admin/outreach?q=founder%40example.com')
  })

  test('keeps dangerous path encodings inert inside query and fragment values', () => {
    expect(safeAuthRedirect('/dashboard?next=%2Fadmin&backslash=%5C&dot=%2e%2e'))
      .toBe('/dashboard?next=%2Fadmin&backslash=%5C&dot=%2e%2e')
    expect(safeAuthRedirect('/dashboard/outreach#next=%2Fadmin&backslash=%5C&dot=%2e%2e'))
      .toBe('/dashboard/outreach#next=%2Fadmin&backslash=%5C&dot=%2e%2e')
  })

  test('rejects unsafe raw auth redirect paths', () => {
    const unsafe: unknown[] = [
      '/dashboard/%2Fadmin',
      '/dashboard/%2fadmin',
      '/dashboard/%5Cadmin',
      '/dashboard/%5cadmin',
      '/dashboard/%2e%2e/admin',
      '/dashboard/%2E%2E/admin',
      '/admin/%2Fdashboard',
      '/admin/%5cdashboard',
      '/admin/%2e%2e/dashboard',
      '/dashboard/../admin',
      '/dashboard/./admin',
      '/admin/../dashboard',
      '/admin/./outreach',
      '/dashboard/%',
      '/dashboard/%2',
      '/dashboard/%GG',
      '/admin/%E0%A4%A',
      'https://evil.test/dashboard',
      'https://launchlog.ai/admin',
      '//evil.test/dashboard',
      String.raw`/\evil.test/dashboard`,
      String.raw`/dashboard\admin`,
      '/dashboard/\u0000admin',
      '/dashboard/\u000aadmin',
      '/login',
      '/login?redirect=/admin',
      '/administrator',
      '/administrator/outreach',
      '/administer',
      '/dashboardish',
      '/api/v1/admin/outreach/candidates/01ARZ3NDEKTSV4RRFFQ69G5FAV',
      '/listing/acme',
      'dashboard',
      '',
      null,
      undefined,
      42,
    ]

    for (const candidate of unsafe) {
      expect(safeAuthRedirect(candidate)).toBe('/dashboard')
    }
  })

  test('falls back for external, protocol-relative, malformed, and unrelated destinations', () => {
    expect(safeAuthRedirect('https://evil.test/dashboard')).toBe('/dashboard')
    expect(safeAuthRedirect('//evil.test/dashboard')).toBe('/dashboard')
    expect(safeAuthRedirect('/\\evil.test/dashboard')).toBe('/dashboard')
    expect(safeAuthRedirect('/listing/acme')).toBe('/dashboard')
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
