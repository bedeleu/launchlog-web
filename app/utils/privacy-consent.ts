export const PRIVACY_CONSENT_VERSION = 1 as const
export const PRIVACY_CONSENT_STORAGE_KEY = 'launchlog:privacy-consent:v1'
export const PRIVACY_CONSENT_TTL_MS = 180 * 24 * 60 * 60 * 1000

export interface PrivacyConsent {
  version: typeof PRIVACY_CONSENT_VERSION
  analytics: boolean
  decidedAt: string
}

interface StorageReader {
  getItem: (key: string) => string | null
}

interface ConsentStorage extends StorageReader {
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const isIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string') return false

  const parsed = new Date(value)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value
}

export const createPrivacyConsent = (
  analytics: boolean,
  decidedAt = new Date().toISOString(),
): PrivacyConsent => ({
  version: PRIVACY_CONSENT_VERSION,
  analytics,
  decidedAt,
})

export const serializePrivacyConsent = (consent: PrivacyConsent): string =>
  JSON.stringify(consent)

export const parsePrivacyConsent = (
  raw: string | null,
  now = Date.now(),
): PrivacyConsent | null => {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null

    const record = parsed as Record<string, unknown>
    if (Object.keys(record).sort().join(',') !== 'analytics,decidedAt,version') return null
    if (record.version !== PRIVACY_CONSENT_VERSION) return null
    if (typeof record.analytics !== 'boolean' || !isIsoTimestamp(record.decidedAt)) return null

    const decidedAt = Date.parse(record.decidedAt)
    if (!Number.isFinite(now) || decidedAt > now || now - decidedAt >= PRIVACY_CONSENT_TTL_MS) return null

    return {
      version: PRIVACY_CONSENT_VERSION,
      analytics: record.analytics,
      decidedAt: record.decidedAt,
    }
  }
  catch {
    return null
  }
}

export const hasAnalyticsConsent = (storage: StorageReader, now = Date.now()): boolean => {
  try {
    return parsePrivacyConsent(storage.getItem(PRIVACY_CONSENT_STORAGE_KEY), now)?.analytics === true
  }
  catch {
    return false
  }
}

export const persistPrivacyConsent = (
  storage: ConsentStorage,
  consent: PrivacyConsent,
): boolean => {
  if (!consent.analytics) {
    try {
      storage.removeItem(PRIVACY_CONSENT_STORAGE_KEY)
    }
    catch {
      // A session-level deny override keeps a stale acceptance inactive.
    }
  }

  try {
    storage.setItem(PRIVACY_CONSENT_STORAGE_KEY, serializePrivacyConsent(consent))
    return true
  }
  catch {
    if (!consent.analytics) {
      try {
        storage.removeItem(PRIVACY_CONSENT_STORAGE_KEY)
      }
      catch {
        // The caller must retain a session-level deny override.
      }
    }
    return false
  }
}
