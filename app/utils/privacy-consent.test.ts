import { describe, expect, test } from 'bun:test'
import {
  PRIVACY_CONSENT_STORAGE_KEY,
  PRIVACY_CONSENT_VERSION,
  createPrivacyConsent,
  hasAnalyticsConsent,
  parsePrivacyConsent,
  persistPrivacyConsent,
  serializePrivacyConsent,
} from './privacy-consent'

const DECIDED_AT = '2026-08-29T10:15:30.000Z'

describe('privacy consent record', () => {
  test('pins a versioned, purpose-specific storage contract', () => {
    expect(PRIVACY_CONSENT_STORAGE_KEY).toBe('launchlog:privacy-consent:v1')
    expect(PRIVACY_CONSENT_VERSION).toBe(1)
    expect(createPrivacyConsent(true, DECIDED_AT)).toEqual({
      version: 1,
      analytics: true,
      decidedAt: DECIDED_AT,
    })
  })

  test('round-trips an explicit acceptance or rejection', () => {
    for (const analytics of [true, false]) {
      const consent = createPrivacyConsent(analytics, DECIDED_AT)
      expect(parsePrivacyConsent(
        serializePrivacyConsent(consent),
        Date.parse('2026-08-29T12:00:00.000Z'),
      )).toEqual(consent)
    }
  })

  test('renews the choice after six months and rejects implausible future decisions', () => {
    const stored = serializePrivacyConsent(createPrivacyConsent(true, DECIDED_AT))

    expect(parsePrivacyConsent(stored, Date.parse('2027-02-25T10:15:29.000Z'))).not.toBeNull()
    expect(parsePrivacyConsent(stored, Date.parse('2027-02-25T10:15:30.000Z'))).toBeNull()
    expect(parsePrivacyConsent(stored, Date.parse('2026-08-29T10:15:29.000Z'))).toBeNull()
  })

  test.each([
    null,
    '',
    'not-json',
    '{}',
    JSON.stringify({ version: 2, analytics: true, decidedAt: DECIDED_AT }),
    JSON.stringify({ version: 1, analytics: 'yes', decidedAt: DECIDED_AT }),
    JSON.stringify({ version: 1, analytics: true, decidedAt: 'yesterday' }),
    JSON.stringify({ version: 1, analytics: true, decidedAt: DECIDED_AT, advertising: true }),
  ])('fails closed for an invalid or stale record: %p', (raw) => {
    expect(parsePrivacyConsent(raw)).toBeNull()
  })

  test('allows analytics only after a valid explicit acceptance', () => {
    const accepted = serializePrivacyConsent(createPrivacyConsent(true, DECIDED_AT))
    const rejected = serializePrivacyConsent(createPrivacyConsent(false, DECIDED_AT))
    const now = Date.parse('2026-08-29T12:00:00.000Z')

    expect(hasAnalyticsConsent({ getItem: () => accepted }, now)).toBe(true)
    expect(hasAnalyticsConsent({ getItem: () => rejected }, now)).toBe(false)
    expect(hasAnalyticsConsent({ getItem: () => null }, now)).toBe(false)
    expect(hasAnalyticsConsent({ getItem: () => { throw new Error('blocked') } }, now)).toBe(false)
  })

  test('clears a stale acceptance before persisting a rejection and reports storage failure', () => {
    const accepted = serializePrivacyConsent(createPrivacyConsent(true, DECIDED_AT))
    let stored: string | null = accepted
    const storage = {
      getItem: () => stored,
      removeItem: () => { stored = null },
      setItem: () => { throw new Error('quota') },
    }

    expect(persistPrivacyConsent(storage, createPrivacyConsent(false, DECIDED_AT))).toBe(false)
    expect(stored).toBeNull()
    expect(hasAnalyticsConsent(storage)).toBe(false)
  })

  test('lets the caller hold a deny override when storage cannot remove the old acceptance', () => {
    const accepted = serializePrivacyConsent(createPrivacyConsent(true, DECIDED_AT))
    const storage = {
      getItem: () => accepted,
      removeItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    }

    expect(persistPrivacyConsent(storage, createPrivacyConsent(false, DECIDED_AT))).toBe(false)
    expect(hasAnalyticsConsent(storage, Date.parse('2026-08-29T12:00:00.000Z'))).toBe(true)
    // usePrivacyConsent records sessionDenyOverride=true on this return path,
    // so refreshFromStorage never reactivates this inaccessible stale value.
  })
})
