import {
  resolvePlausibleCapability,
  type PlausibleCapability,
} from '../../shared/utils/plausible-capability'

export { resolvePlausibleCapability }
export type { PlausibleCapability }

export const FUNNEL_EVENTS = [
  'Preview Created',
  'Checkout Started',
  'Payment Canceled',
  'Listing Published',
] as const

export type FunnelEvent = typeof FUNNEL_EVENTS[number]

export const BROWSER_FUNNEL_EVENTS = [
  'Preview Created',
  'Checkout Started',
  'Payment Canceled',
  'Listing Published',
] as const satisfies readonly FunnelEvent[]

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const
const REDDIT_UTM_CONTRACT: Record<typeof UTM_KEYS[number], ReadonlySet<string>> = {
  utm_source: new Set(['reddit']),
  utm_medium: new Set(['paid_social']),
  utm_campaign: new Set(['reddit_founder_listing_test_01']),
  utm_content: new Set(['preview_before_pay', 'durable_release_record']),
  utm_term: new Set(['community_founders', 'keyword_launch_intent']),
}

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

const isPublicPath = (path: string): boolean =>
  STATIC_PUBLIC_PATHS.has(path)
  || /^\/(?:listing|blog)\/[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/.test(path)

export const sanitizePublicAnalyticsUrl = (
  rawPath: string,
  capability: PlausibleCapability,
): string | null => {
  let parsed: URL
  try {
    parsed = new URL(rawPath, capability.origin)
  }
  catch {
    return null
  }

  if (parsed.origin !== capability.origin) return null

  const pathname = parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/+$/, '')
  if (!isPublicPath(pathname)) return null

  const attribution = UTM_KEYS.map((key) => {
    const values = parsed.searchParams.getAll(key)
    const value = values.length === 1 ? values[0]! : null
    return value !== null && REDDIT_UTM_CONTRACT[key].has(value)
      ? ([key, value] as const)
      : null
  })
  const safeQuery = new URLSearchParams()
  if (attribution.every((entry): entry is readonly [typeof UTM_KEYS[number], string] => entry !== null)) {
    for (const [key, value] of attribution) safeQuery.set(key, value)
  }

  const query = safeQuery.toString()
  return `${capability.origin}${pathname}${query ? `?${query}` : ''}`
}

export const sanitizePlausibleRequest = (
  payload: Record<string, unknown>,
  capability: PlausibleCapability,
): Record<string, unknown> | null => {
  if (typeof payload.url !== 'string' || typeof payload.name !== 'string') return null
  if (payload.domain !== new URL(capability.origin).hostname) return null
  if (payload.name !== 'pageview' && !(BROWSER_FUNNEL_EVENTS as readonly string[]).includes(payload.name)) return null

  const safeUrl = sanitizePublicAnalyticsUrl(payload.url, capability)
  if (safeUrl === null) return null

  return {
    domain: payload.domain,
    name: payload.name,
    url: safeUrl,
  }
}

export type PlausibleFetch = (
  input: string,
  init: RequestInit,
) => Promise<{ ok: boolean }>

export const postPlausibleEvent = async (
  payload: Record<string, unknown>,
  capability: PlausibleCapability,
  fetcher: PlausibleFetch,
  signal?: AbortSignal,
): Promise<boolean> => {
  if (signal?.aborted) return false

  const safePayload = sanitizePlausibleRequest(payload, capability)
  if (safePayload === null) return false

  try {
    const response = await fetcher(capability.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(safePayload),
      cache: 'no-store',
      credentials: 'omit',
      keepalive: true,
      mode: 'cors',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal,
    })

    return response.ok
  }
  catch {
    return false
  }
}

export interface PlausibleEventSender {
  enable: () => void
  disable: () => void
  send: (event: string, rawPath: string) => void
}

export const createPlausibleEventSender = (
  capability: PlausibleCapability,
  fetcher: PlausibleFetch,
  isAllowed: () => boolean,
): PlausibleEventSender => {
  const domain = new URL(capability.origin).hostname
  let controller: AbortController | null = null

  return {
    enable: () => {
      controller ??= new AbortController()
    },
    disable: () => {
      controller?.abort()
      controller = null
    },
    send: (event, rawPath) => {
      if (controller === null || !isAllowed()) return

      const url = sanitizePublicAnalyticsUrl(rawPath, capability)
      if (url === null) return

      void postPlausibleEvent(
        { domain, name: event, url },
        capability,
        fetcher,
        controller.signal,
      )
    },
  }
}

export const safeFunnelEventUrl = (
  _event: FunnelEvent,
  capability: PlausibleCapability,
): string => `${capability.origin}/submit`
