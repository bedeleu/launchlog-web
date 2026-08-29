import { describe, expect, test } from 'bun:test'
import {
  LEGACY_PRIVACY_CONSENT_STORAGE_KEY,
  PRIVACY_CONSENT_STORAGE_KEY,
  PRIVACY_CONSENT_VERSION,
  createPrivacyConsent,
  hasAdvertisingConsent,
  hasAnalyticsConsent,
  parsePrivacyConsent,
  persistPrivacyConsent,
  readPrivacyConsent,
  serializePrivacyConsent,
} from './privacy-consent'

const DECIDED_AT = '2026-08-29T10:15:30.000Z'

describe('privacy consent record', () => {
  test('pins a versioned, purpose-specific storage contract', () => {
    expect(PRIVACY_CONSENT_STORAGE_KEY).toBe('launchlog:privacy-consent:v2')
    expect(LEGACY_PRIVACY_CONSENT_STORAGE_KEY).toBe('launchlog:privacy-consent:v1')
    expect(PRIVACY_CONSENT_VERSION).toBe(2)
    expect(createPrivacyConsent(true, false, DECIDED_AT)).toEqual({
      version: 2,
      analytics: true,
      advertising: false,
      decidedAt: DECIDED_AT,
    })
  })

  test('round-trips an explicit acceptance or rejection', () => {
    for (const [analytics, advertising] of [[true, true], [true, false], [false, true], [false, false]] as const) {
      const consent = createPrivacyConsent(analytics, advertising, DECIDED_AT)
      expect(parsePrivacyConsent(
        serializePrivacyConsent(consent),
        Date.parse('2026-08-29T12:00:00.000Z'),
      )).toEqual(consent)
    }
  })

  test('migrates a valid analytics-only decision without opting into advertising', () => {
    const legacy = JSON.stringify({
      version: 1,
      analytics: true,
      decidedAt: DECIDED_AT,
    })
    const storage = {
      getItem: (key: string) => key === LEGACY_PRIVACY_CONSENT_STORAGE_KEY ? legacy : null,
    }

    expect(readPrivacyConsent(storage, Date.parse('2026-08-29T12:00:00.000Z'))).toEqual({
      version: 2,
      analytics: true,
      advertising: false,
      decidedAt: DECIDED_AT,
    })
    expect(hasAnalyticsConsent(storage, Date.parse('2026-08-29T12:00:00.000Z'))).toBe(true)
    expect(hasAdvertisingConsent(storage, Date.parse('2026-08-29T12:00:00.000Z'))).toBe(false)
  })

  test('renews the choice after six months and rejects implausible future decisions', () => {
    const stored = serializePrivacyConsent(createPrivacyConsent(true, false, DECIDED_AT))

    expect(parsePrivacyConsent(stored, Date.parse('2027-02-25T10:15:29.000Z'))).not.toBeNull()
    expect(parsePrivacyConsent(stored, Date.parse('2027-02-25T10:15:30.000Z'))).toBeNull()
    expect(parsePrivacyConsent(stored, Date.parse('2026-08-29T10:15:29.000Z'))).toBeNull()
  })

  test.each([
    null,
    '',
    'not-json',
    '{}',
    JSON.stringify({ version: 1, analytics: true, decidedAt: DECIDED_AT }),
    JSON.stringify({ version: 2, analytics: 'yes', advertising: false, decidedAt: DECIDED_AT }),
    JSON.stringify({ version: 2, analytics: true, advertising: 'yes', decidedAt: DECIDED_AT }),
    JSON.stringify({ version: 2, analytics: true, advertising: false, decidedAt: 'yesterday' }),
    JSON.stringify({ version: 2, analytics: true, advertising: false, decidedAt: DECIDED_AT, extra: true }),
  ])('fails closed for an invalid or stale record: %p', (raw) => {
    expect(parsePrivacyConsent(raw)).toBeNull()
  })

  test('allows each optional purpose only after its own explicit acceptance', () => {
    const analyticsOnly = serializePrivacyConsent(createPrivacyConsent(true, false, DECIDED_AT))
    const advertisingOnly = serializePrivacyConsent(createPrivacyConsent(false, true, DECIDED_AT))
    const rejected = serializePrivacyConsent(createPrivacyConsent(false, false, DECIDED_AT))
    const now = Date.parse('2026-08-29T12:00:00.000Z')

    expect(hasAnalyticsConsent({ getItem: () => analyticsOnly }, now)).toBe(true)
    expect(hasAdvertisingConsent({ getItem: () => analyticsOnly }, now)).toBe(false)
    expect(hasAnalyticsConsent({ getItem: () => advertisingOnly }, now)).toBe(false)
    expect(hasAdvertisingConsent({ getItem: () => advertisingOnly }, now)).toBe(true)
    expect(hasAnalyticsConsent({ getItem: () => rejected }, now)).toBe(false)
    expect(hasAdvertisingConsent({ getItem: () => rejected }, now)).toBe(false)
    expect(hasAnalyticsConsent({ getItem: () => null }, now)).toBe(false)
    expect(hasAnalyticsConsent({ getItem: () => { throw new Error('blocked') } }, now)).toBe(false)
  })

  test('clears a stale acceptance before persisting a partial rejection and reports storage failure', () => {
    const accepted = serializePrivacyConsent(createPrivacyConsent(true, true, DECIDED_AT))
    let stored: string | null = accepted
    const storage = {
      getItem: (key: string) => key === PRIVACY_CONSENT_STORAGE_KEY ? stored : null,
      removeItem: (key: string) => {
        if (key === PRIVACY_CONSENT_STORAGE_KEY) stored = null
      },
      setItem: () => { throw new Error('quota') },
    }

    expect(persistPrivacyConsent(storage, createPrivacyConsent(true, false, DECIDED_AT))).toBe(false)
    expect(stored).toBeNull()
    expect(hasAdvertisingConsent(storage)).toBe(false)
  })

  test('lets the caller hold a deny override when storage cannot remove the old acceptance', () => {
    const accepted = serializePrivacyConsent(createPrivacyConsent(true, true, DECIDED_AT))
    const storage = {
      getItem: (key: string) => key === PRIVACY_CONSENT_STORAGE_KEY ? accepted : null,
      removeItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    }

    expect(persistPrivacyConsent(storage, createPrivacyConsent(false, false, DECIDED_AT))).toBe(false)
    expect(hasAnalyticsConsent(storage, Date.parse('2026-08-29T12:00:00.000Z'))).toBe(true)
    // usePrivacyConsent records sessionDenyOverride=true on this return path,
    // so refreshFromStorage never reactivates this inaccessible stale value.
  })
})
