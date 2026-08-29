import { createMetaEventId } from './meta-pixel'
import { hasAdvertisingConsent, hasAnalyticsConsent } from './privacy-consent'
import type { FunnelEvent } from './plausible-privacy'

interface AnalyticsWindow {
  crypto: Pick<Crypto, 'randomUUID'>
  document: Pick<Document, 'cookie'>
  fetch: typeof fetch
  localStorage: Storage
  location: Pick<Location, 'origin'>
  navigator: Navigator
  plausible?: (event: string, options?: { url: string }) => void
  launchlogMetaEvent?: (event: FunnelEvent, eventId: string) => boolean
}

const readCookie = (cookieHeader: string, name: '_fbp' | '_fbc'): string | undefined => {
  const prefix = `${name}=`
  const value = cookieHeader
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(prefix))
    ?.slice(prefix.length)

  return value || undefined
}

const productionOrigin = (rawOrigin: string): URL | null => {
  try {
    const origin = new URL(rawOrigin)
    if (
      origin.origin !== 'https://launchlog.ai'
      || origin.username
      || origin.password
      || origin.search
      || origin.hash
    ) return null

    return origin
  }
  catch {
    return null
  }
}

const trackPlausible = (event: FunnelEvent, analyticsWindow: AnalyticsWindow, origin: URL): void => {
  try {
    if (!hasAnalyticsConsent(analyticsWindow.localStorage)) return
    analyticsWindow.plausible?.(event, { url: `${origin.origin}/submit` })
  }
  catch {
    // Analytics must never alter the product flow.
  }
}

const trackMeta = (event: FunnelEvent, analyticsWindow: AnalyticsWindow): void => {
  try {
    if (
      analyticsWindow.navigator.globalPrivacyControl === true
      || !hasAdvertisingConsent(analyticsWindow.localStorage)
    ) return

    const eventId = createMetaEventId(() => analyticsWindow.crypto.randomUUID())
    analyticsWindow.launchlogMetaEvent?.(event, eventId)

    const fbp = readCookie(analyticsWindow.document.cookie, '_fbp')
    const fbc = readCookie(analyticsWindow.document.cookie, '_fbc')
    const body = {
      event,
      eventId,
      advertisingConsent: true,
      ...(fbp ? { fbp } : {}),
      ...(fbc ? { fbc } : {}),
    }

    void analyticsWindow.fetch('/api/meta-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      credentials: 'omit',
      keepalive: true,
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    }).catch(() => {
      // Advertising measurement must never alter the product flow.
    })
  }
  catch {
    // Advertising measurement must never alter the product flow.
  }
}

export function track(event: FunnelEvent): void {
  if (typeof window === 'undefined') return

  const analyticsWindow = window as unknown as AnalyticsWindow
  const origin = productionOrigin(analyticsWindow.location?.origin)
  if (origin === null) return

  trackPlausible(event, analyticsWindow, origin)
  trackMeta(event, analyticsWindow)
}
