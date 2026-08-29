export interface ExpiringIntakeDraft {
  expiresAt: string | null
}

export interface PersistedPreviewDraft extends ExpiringIntakeDraft {
  token: string
  sourceUrl: string
  url: string
  domain: string
  title: string
  tagline: string
  description: string
  email: string
  tier: 'basic' | 'featured'
  screenshotUrl: string | null
  status: string
  previewCreatedMeasurementPending?: boolean
  updatedAt: string
}

export interface IntakeRetentionState<T extends ExpiringIntakeDraft> {
  drafts: Record<string, T>
  latestToken: string | null
  urlIndex: Record<string, string>
}

export interface PrunedIntakeState<T extends ExpiringIntakeDraft> extends IntakeRetentionState<T> {
  changed: boolean
}

export type IntakeDraftValidator<T extends ExpiringIntakeDraft> = (
  value: unknown,
  storageToken: string,
) => value is T

export const createFailClosedJsonSerializer = <T>(
  fallback: () => T,
  removeCorruptValue: () => void,
): { read: (raw: string) => T, write: (value: T) => string } => ({
  read: (raw) => {
    try {
      return JSON.parse(raw) as T
    }
    catch {
      removeCorruptValue()
      return fallback()
    }
  },
  write: value => JSON.stringify(value),
})

const PRIVATE_PREVIEW_BROWSER_TTL_MS = 7 * 24 * 60 * 60 * 1000
const UNSAFE_RECORD_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const PREVIEW_TOKEN_PATTERN = /^[A-Za-z0-9]{64}$/
const PREVIEW_STATUSES = new Set(['generating', 'ready', 'failed', 'converted', 'expired'])

export const resolvePreviewCreatedMeasurement = (
  pending: boolean,
  status: string,
): { nextPending: boolean, shouldTrack: boolean } => {
  if (!pending) return { nextPending: false, shouldTrack: false }
  if (status === 'generating') return { nextPending: true, shouldTrack: false }

  return {
    nextPending: false,
    shouldTrack: status === 'ready',
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isExpiringIntakeDraft = (value: unknown): value is ExpiringIntakeDraft => {
  if (!isRecord(value)) return false

  return value.expiresAt === null || typeof value.expiresAt === 'string'
}

const isCanonicalIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string') return false

  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/u.exec(value)
  if (!match) return false

  const parsed = new Date(value)
  const milliseconds = (match[2] ?? '').padEnd(3, '0').slice(0, 3)
  return !Number.isNaN(parsed.getTime())
    && parsed.toISOString() === `${match[1]}.${milliseconds}Z`
}

const isBoundedString = (value: unknown, maximum: number): value is string =>
  typeof value === 'string' && value.length <= maximum

const isPreviewDomain = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length < 1 || value.length > 253 || value !== value.toLowerCase()) {
    return false
  }

  try {
    const parsed = new URL(`https://${value}`)
    return parsed.hostname === value && parsed.host === value && parsed.pathname === '/'
  }
  catch {
    return false
  }
}

export const isPersistedPreviewDraft = (
  value: unknown,
  storageToken?: string,
): value is PersistedPreviewDraft => {
  if (!isRecord(value)) return false

  return typeof value.token === 'string'
    && PREVIEW_TOKEN_PATTERN.test(value.token)
    && (storageToken === undefined || value.token === storageToken)
    && typeof value.sourceUrl === 'string'
    && isRetainableHttpUrl(value.sourceUrl)
    && typeof value.url === 'string'
    && isRetainableHttpUrl(value.url)
    && isPreviewDomain(value.domain)
    && isBoundedString(value.title, 200)
    && isBoundedString(value.tagline, 500)
    && isBoundedString(value.description, 10_000)
    && isBoundedString(value.email, 254)
    && (value.email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.email))
    && (value.tier === 'basic' || value.tier === 'featured')
    && (value.screenshotUrl === null || (typeof value.screenshotUrl === 'string' && isRetainableHttpUrl(value.screenshotUrl)))
    && typeof value.status === 'string'
    && PREVIEW_STATUSES.has(value.status)
    && (value.previewCreatedMeasurementPending === undefined || typeof value.previewCreatedMeasurementPending === 'boolean')
    && (value.expiresAt === null || isCanonicalIsoTimestamp(value.expiresAt))
    && isCanonicalIsoTimestamp(value.updatedAt)
}

const isRetainableHttpUrl = (value: string): boolean => {
  if (!value || value.length > 2048) return false

  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && !url.username
      && !url.password
  }
  catch {
    return false
  }
}

export const createIntakeLastUrlExpiry = (
  now = Date.now(),
  previewExpiry?: string | null,
): string => {
  const maximum = now + PRIVATE_PREVIEW_BROWSER_TTL_MS
  const parsedPreviewExpiry = previewExpiry ? Date.parse(previewExpiry) : Number.NaN
  const expiry = Number.isFinite(parsedPreviewExpiry)
    ? Math.min(maximum, parsedPreviewExpiry)
    : maximum

  return new Date(expiry).toISOString()
}

export const resolveRetainedLastUrl = (
  value: unknown,
  expiresAt: unknown,
  now = Date.now(),
): { value: string, expiresAt: string | null, changed: boolean } => {
  if (value === '' && expiresAt === null) {
    return { value: '', expiresAt: null, changed: false }
  }

  const normalizedValue = typeof value === 'string' ? value.trim() : ''
  if (
    !isRetainableHttpUrl(normalizedValue)
    || !isCanonicalIsoTimestamp(expiresAt)
    || Date.parse(expiresAt) <= now
    || Date.parse(expiresAt) > now + PRIVATE_PREVIEW_BROWSER_TTL_MS
  ) {
    return { value: '', expiresAt: null, changed: true }
  }

  return {
    value: normalizedValue,
    expiresAt,
    changed: normalizedValue !== value,
  }
}

export const pruneExpiredIntakeState = <T extends ExpiringIntakeDraft>(
  state: IntakeRetentionState<T>,
  now = Date.now(),
  validateDraft?: IntakeDraftValidator<T>,
): PrunedIntakeState<T> => {
  const persistedState: unknown = state
  const rawState = isRecord(persistedState) ? persistedState : {}
  const rawDrafts = isRecord(rawState.drafts) ? rawState.drafts : {}
  const rawUrlIndex = isRecord(rawState.urlIndex) ? rawState.urlIndex : {}
  const retainedDraftEntries: Array<[string, T]> = []
  let changed = !isRecord(persistedState) || !isRecord(rawState.drafts) || !isRecord(rawState.urlIndex)

  for (const [token, draft] of Object.entries(rawDrafts)) {
    if (
      UNSAFE_RECORD_KEYS.has(token)
      || !isExpiringIntakeDraft(draft)
      || (validateDraft && !validateDraft(draft, token))
    ) {
      changed = true
      continue
    }

    const updatedAt = isRecord(draft) && isCanonicalIsoTimestamp(draft.updatedAt)
      ? Date.parse(draft.updatedAt)
      : null
    if (updatedAt !== null && updatedAt > now) {
      changed = true
      continue
    }

    const browserMaximum = updatedAt === null
      ? null
      : updatedAt + PRIVATE_PREVIEW_BROWSER_TTL_MS
    const declaredExpiry = draft.expiresAt === null ? null : Date.parse(draft.expiresAt)
    const expiry = browserMaximum === null
      ? declaredExpiry
      : declaredExpiry === null
        ? browserMaximum
        : Math.min(declaredExpiry, browserMaximum)
    const expired = expiry !== null && (!Number.isFinite(expiry) || expiry <= now)
    if (expired) {
      changed = true
      continue
    }
    retainedDraftEntries.push([token, draft as T])
  }

  const drafts = Object.fromEntries(retainedDraftEntries) as Record<string, T>

  const retainedUrlEntries: Array<[string, string]> = []
  for (const [url, token] of Object.entries(rawUrlIndex)) {
    if (
      !UNSAFE_RECORD_KEYS.has(url)
      && typeof token === 'string'
      && Object.hasOwn(drafts, token)
    ) retainedUrlEntries.push([url, token])
    else changed = true
  }

  const urlIndex = Object.fromEntries(retainedUrlEntries) as Record<string, string>

  const rawLatestToken = rawState.latestToken
  const latestToken = typeof rawLatestToken === 'string' && Object.hasOwn(drafts, rawLatestToken)
    ? rawLatestToken
    : null
  if (latestToken !== rawLatestToken) changed = true

  return { drafts, latestToken, urlIndex, changed }
}
