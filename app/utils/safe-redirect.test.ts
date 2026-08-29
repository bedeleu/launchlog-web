import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  authMagicLinkUrl,
  clearMagicLinkEmail,
  readMagicLinkEmail,
  rememberMagicLinkEmail,
  resolveMagicLinkEmail,
  safeAuthRedirect,
} from './safe-redirect'

interface RetentionStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

class MemoryStorage implements RetentionStorage {
  readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

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

describe('magic-link email retention', () => {
  const emailKey = 'launchlog:magic-link-email'
  const expiryKey = 'launchlog:magic-link-email-expires-at'
  const now = Date.parse('2026-08-29T10:00:00.000Z')

  test('keeps a canonical email for one hour with a companion expiry', () => {
    const storage = new MemoryStorage()

    expect(rememberMagicLinkEmail(storage, '  maker@example.com  ', now)).toBe(true)
    expect(storage.getItem(emailKey)).toBe('maker@example.com')
    expect(storage.getItem(expiryKey)).toBe('2026-08-29T11:00:00.000Z')
    expect(readMagicLinkEmail(storage, now + 30 * 60 * 1000)).toBe('maker@example.com')
  })

  test('expires the email and clears both retention keys', () => {
    const storage = new MemoryStorage()
    storage.setItem(emailKey, 'maker@example.com')
    storage.setItem(expiryKey, '2026-08-29T11:00:00.000Z')

    expect(readMagicLinkEmail(storage, now + 60 * 60 * 1000)).toBeNull()
    expect(storage.getItem(emailKey)).toBeNull()
    expect(storage.getItem(expiryKey)).toBeNull()
  })

  test('fails closed for missing, malformed, or implausibly distant expiries', () => {
    for (const expiresAt of [null, 'not-a-date', '2026-08-29T12:00:00.000Z']) {
      const storage = new MemoryStorage()
      storage.setItem(emailKey, 'maker@example.com')
      if (expiresAt) storage.setItem(expiryKey, expiresAt)

      expect(readMagicLinkEmail(storage, now)).toBeNull()
      expect(storage.getItem(emailKey)).toBeNull()
      expect(storage.getItem(expiryKey)).toBeNull()
    }
  })

  test('fails closed for corrupt email values', () => {
    const storage = new MemoryStorage()
    storage.setItem(emailKey, 'not-an-email')
    storage.setItem(expiryKey, '2026-08-29T11:00:00.000Z')

    expect(readMagicLinkEmail(storage, now)).toBeNull()
    expect(storage.getItem(emailKey)).toBeNull()
    expect(storage.getItem(expiryKey)).toBeNull()
  })

  test('clears both keys explicitly', () => {
    const storage = new MemoryStorage()
    storage.setItem(emailKey, 'maker@example.com')
    storage.setItem(expiryKey, '2026-08-29T11:00:00.000Z')

    clearMagicLinkEmail(storage)

    expect(storage.getItem(emailKey)).toBeNull()
    expect(storage.getItem(expiryKey)).toBeNull()
  })

  test('does not leave an indefinitely retained email when storage writes fail', () => {
    const storage = new MemoryStorage()
    const setItem = storage.setItem.bind(storage)
    storage.setItem = (key, value) => {
      if (key === emailKey) throw new Error('quota exceeded')
      setItem(key, value)
    }

    expect(() => rememberMagicLinkEmail(storage, 'maker@example.com', now)).not.toThrow()
    expect(rememberMagicLinkEmail(storage, 'maker@example.com', now)).toBe(false)
    expect(storage.getItem(emailKey)).toBeNull()
    expect(storage.getItem(expiryKey)).toBeNull()
  })

  test('prunes expired or legacy email state when auth initializes and before completion', () => {
    const source = readFileSync(fileURLToPath(new URL('../composables/useAuth.ts', import.meta.url)), 'utf8')
    expect(source.match(/readMagicLinkEmail\(window\.localStorage\)/g)?.length).toBeGreaterThanOrEqual(2)
  })
})
