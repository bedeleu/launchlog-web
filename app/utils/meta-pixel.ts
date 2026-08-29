import type { FunnelEvent } from './plausible-privacy'

const META_SCRIPT_URL = 'https://connect.facebook.net/en_US/fbevents.js'
const PIXEL_ID_PATTERN = /^\d{5,20}$/
const EVENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const STATIC_PUBLIC_PATHS = new Set([
  '/',
  '/about',
  '/api-docs',
  '/blog',
  '/browse-all',
  '/contact',
  '/cookies',
  '/dmca',
  '/featured',
  '/help',
  '/pricing',
  '/privacy',
  '/seo-guide',
  '/status',
  '/submit',
  '/tech-products',
  '/terms',
])

export interface MetaPixelCapability {
  origin: 'https://launchlog.ai'
  pixelId: string
  scriptUrl: typeof META_SCRIPT_URL
}

export interface MetaEventMapping {
  method: 'track' | 'trackCustom'
  name: 'PreviewCreated' | 'InitiateCheckout' | 'PaymentCanceled' | 'ListingPublished'
}

export const normalizeMetaPixelId = (value: unknown): string | null => {
  const normalized = typeof value === 'number' && Number.isSafeInteger(value)
    ? String(value)
    : value

  return typeof normalized === 'string' && PIXEL_ID_PATTERN.test(normalized)
    ? normalized
    : null
}

const isPublicPath = (path: string): boolean =>
  STATIC_PUBLIC_PATHS.has(path)
  || /^\/(?:listing|blog)\/[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/.test(path)

export const resolveMetaPixelCapability = (input: {
  enabled: unknown
  domain: unknown
  pixelId: unknown
}): MetaPixelCapability | null => {
  const pixelId = normalizeMetaPixelId(input.pixelId)
  if (
    input.enabled !== true
    || input.domain !== 'launchlog.ai'
    || pixelId === null
  ) return null

  return {
    origin: 'https://launchlog.ai',
    pixelId,
    scriptUrl: META_SCRIPT_URL,
  }
}

export const sanitizePublicMetaUrl = (
  rawPath: string,
  capability: MetaPixelCapability,
): string | null => {
  try {
    const parsed = new URL(rawPath, capability.origin)
    if (parsed.origin !== capability.origin) return null

    const pathname = parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/+$/, '')
    return isPublicPath(pathname) ? `${capability.origin}${pathname}` : null
  }
  catch {
    return null
  }
}

export const mapFunnelEventToMeta = (event: FunnelEvent): MetaEventMapping => {
  const events: Record<FunnelEvent, MetaEventMapping> = {
    'Preview Created': { method: 'trackCustom', name: 'PreviewCreated' },
    'Checkout Started': { method: 'track', name: 'InitiateCheckout' },
    'Payment Canceled': { method: 'trackCustom', name: 'PaymentCanceled' },
    'Listing Published': { method: 'trackCustom', name: 'ListingPublished' },
  }

  return events[event]
}

export const createMetaEventId = (
  randomUuid: () => string = () => crypto.randomUUID(),
): string => {
  const eventId = randomUuid()
  if (!EVENT_ID_PATTERN.test(eventId)) throw new Error('Unable to create a safe Meta event identifier')
  return eventId
}

export const isMetaEventId = (value: unknown): value is string =>
  typeof value === 'string' && EVENT_ID_PATTERN.test(value)
