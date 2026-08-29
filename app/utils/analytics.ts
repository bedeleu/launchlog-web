import { hasAnalyticsConsent } from './privacy-consent'
import type { FunnelEvent } from './plausible-privacy'

interface AnalyticsWindow {
  localStorage: Storage
  location: Pick<Location, 'origin'>
  plausible?: (event: string, options?: { url: string }) => void
}

export function track(event: FunnelEvent): void {
  if (typeof window === 'undefined') return

  try {
    const analyticsWindow = window as unknown as AnalyticsWindow
    if (!hasAnalyticsConsent(analyticsWindow.localStorage)) return

    const origin = new URL(analyticsWindow.location.origin)
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash) return

    analyticsWindow.plausible?.(event, { url: `${origin.origin}/submit` })
  }
  catch {
    // Analytics must never alter the product flow.
  }
}
