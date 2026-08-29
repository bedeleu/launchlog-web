const DASHBOARD_FALLBACK = '/dashboard'
const MAGIC_LINK_EMAIL_KEY = 'launchlog:magic-link-email'
const MAGIC_LINK_EMAIL_EXPIRY_KEY = 'launchlog:magic-link-email-expires-at'
const MAGIC_LINK_EMAIL_TTL_MS = 60 * 60 * 1000

interface RetentionStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const canonicalEmail = (value: unknown): string | null => {
  if (typeof value !== 'string') return null

  const email = value.trim()
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+$/u.test(email)) {
    return null
  }

  return email
}

const isCanonicalIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string') return false

  const parsed = new Date(value)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value
}

export function clearMagicLinkEmail(storage: RetentionStorage): void {
  try {
    storage.removeItem(MAGIC_LINK_EMAIL_KEY)
  }
  catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }

  try {
    storage.removeItem(MAGIC_LINK_EMAIL_EXPIRY_KEY)
  }
  catch {
    // Best effort: reads still fail closed without a valid companion expiry.
  }
}

export function rememberMagicLinkEmail(
  storage: RetentionStorage,
  value: unknown,
  now = Date.now(),
): boolean {
  const email = canonicalEmail(value)
  if (!email || !Number.isFinite(now)) {
    clearMagicLinkEmail(storage)
    return false
  }

  clearMagicLinkEmail(storage)

  try {
    storage.setItem(MAGIC_LINK_EMAIL_EXPIRY_KEY, new Date(now + MAGIC_LINK_EMAIL_TTL_MS).toISOString())
    storage.setItem(MAGIC_LINK_EMAIL_KEY, email)
    return true
  }
  catch {
    clearMagicLinkEmail(storage)
    return false
  }
}

export function readMagicLinkEmail(storage: RetentionStorage, now = Date.now()): string | null {
  let value: string | null
  let expiresAt: string | null

  try {
    value = storage.getItem(MAGIC_LINK_EMAIL_KEY)
    expiresAt = storage.getItem(MAGIC_LINK_EMAIL_EXPIRY_KEY)
  }
  catch {
    clearMagicLinkEmail(storage)
    return null
  }

  const email = canonicalEmail(value)
  const expiry = isCanonicalIsoTimestamp(expiresAt) ? Date.parse(expiresAt) : Number.NaN
  if (
    !email
    || email !== value
    || !Number.isFinite(now)
    || !Number.isFinite(expiry)
    || expiry <= now
    || expiry > now + MAGIC_LINK_EMAIL_TTL_MS
  ) {
    clearMagicLinkEmail(storage)
    return null
  }

  return email
}

export function safeAuthRedirect(candidate: unknown): string {
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return DASHBOARD_FALLBACK
  }

  try {
    const target = new URL(candidate, 'https://launchlog.ai')
    const isDashboardRoute = target.pathname === '/dashboard'
      || target.pathname.startsWith('/dashboard/')

    if (target.origin !== 'https://launchlog.ai' || !isDashboardRoute) {
      return DASHBOARD_FALLBACK
    }

    return `${target.pathname}${target.search}${target.hash}`
  }
  catch {
    return DASHBOARD_FALLBACK
  }
}

export function authMagicLinkUrl(origin: string, redirect: unknown): string {
  const target = new URL('/login', origin)
  target.searchParams.set('magic', '1')
  target.searchParams.set('redirect', safeAuthRedirect(redirect))
  return target.toString()
}

export function resolveMagicLinkEmail(storedEmail: string | null, confirmedEmail?: string): string | null {
  const email = confirmedEmail?.trim() || storedEmail?.trim()
  return email || null
}
