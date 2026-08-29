export const PRIVACY_CONSENT_VERSION = 2 as const
export const PRIVACY_CONSENT_STORAGE_KEY = 'launchlog:privacy-consent:v2'
export const LEGACY_PRIVACY_CONSENT_STORAGE_KEY = 'launchlog:privacy-consent:v1'
export const PRIVACY_CONSENT_TTL_MS = 180 * 24 * 60 * 60 * 1000

export interface PrivacyConsent {
  version: typeof PRIVACY_CONSENT_VERSION
  analytics: boolean
  advertising: boolean
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

const isCurrentDecision = (decidedAt: string, now: number): boolean => {
  const decidedAtMs = Date.parse(decidedAt)
  return Number.isFinite(now)
    && decidedAtMs <= now
    && now - decidedAtMs < PRIVACY_CONSENT_TTL_MS
}

export const createPrivacyConsent = (
  analytics: boolean,
  advertising: boolean,
  decidedAt = new Date().toISOString(),
): PrivacyConsent => ({
  version: PRIVACY_CONSENT_VERSION,
  analytics,
  advertising,
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
    if (Object.keys(record).sort().join(',') !== 'advertising,analytics,decidedAt,version') return null
    if (record.version !== PRIVACY_CONSENT_VERSION) return null
    if (
      typeof record.analytics !== 'boolean'
      || typeof record.advertising !== 'boolean'
      || !isIsoTimestamp(record.decidedAt)
      || !isCurrentDecision(record.decidedAt, now)
    ) return null

    return {
      version: PRIVACY_CONSENT_VERSION,
      analytics: record.analytics,
      advertising: record.advertising,
      decidedAt: record.decidedAt,
    }
  }
  catch {
    return null
  }
}

const parseLegacyPrivacyConsent = (
  raw: string | null,
  now = Date.now(),
): PrivacyConsent | null => {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null

    const record = parsed as Record<string, unknown>
    if (Object.keys(record).sort().join(',') !== 'analytics,decidedAt,version') return null
    if (
      record.version !== 1
      || typeof record.analytics !== 'boolean'
      || !isIsoTimestamp(record.decidedAt)
      || !isCurrentDecision(record.decidedAt, now)
    ) return null

    return createPrivacyConsent(record.analytics, false, record.decidedAt)
  }
  catch {
    return null
  }
}

export const readPrivacyConsent = (
  storage: StorageReader,
  now = Date.now(),
): PrivacyConsent | null => {
  try {
    const current = parsePrivacyConsent(storage.getItem(PRIVACY_CONSENT_STORAGE_KEY), now)
    if (current !== null) return current

    return parseLegacyPrivacyConsent(storage.getItem(LEGACY_PRIVACY_CONSENT_STORAGE_KEY), now)
  }
  catch {
    return null
  }
}

export const hasAnalyticsConsent = (storage: StorageReader, now = Date.now()): boolean =>
  readPrivacyConsent(storage, now)?.analytics === true

export const hasAdvertisingConsent = (storage: StorageReader, now = Date.now()): boolean =>
  readPrivacyConsent(storage, now)?.advertising === true

export const persistPrivacyConsent = (
  storage: ConsentStorage,
  consent: PrivacyConsent,
): boolean => {
  if (!consent.analytics || !consent.advertising) {
    try {
      storage.removeItem(PRIVACY_CONSENT_STORAGE_KEY)
      storage.removeItem(LEGACY_PRIVACY_CONSENT_STORAGE_KEY)
    }
    catch {
      // The caller retains a session-level override if persistence also fails.
    }
  }

  try {
    storage.setItem(PRIVACY_CONSENT_STORAGE_KEY, serializePrivacyConsent(consent))
    try {
      storage.removeItem(LEGACY_PRIVACY_CONSENT_STORAGE_KEY)
    }
    catch {
      // A valid v2 record always takes precedence over the legacy record.
    }
    return true
  }
  catch {
    if (!consent.analytics || !consent.advertising) {
      try {
        storage.removeItem(PRIVACY_CONSENT_STORAGE_KEY)
        storage.removeItem(LEGACY_PRIVACY_CONSENT_STORAGE_KEY)
      }
      catch {
        // The caller must retain a session-level override.
      }
    }
    return false
  }
}
