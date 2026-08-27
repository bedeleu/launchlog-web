// Thin, SSR-safe wrapper over the self-hosted Plausible queue. `window.plausible`
// is defined by the init stub in app.vue only when NUXT_PUBLIC_PLAUSIBLE_SRC is
// set, so this is a no-op on the server and when analytics is disabled.
export type FunnelEvent =
  | 'Preview Created'
  | 'Checkout Started'
  | 'Payment Canceled'
  | 'Listing Published'

export function track(event: FunnelEvent): void {
  if (typeof window !== 'undefined') {
    (window as unknown as { plausible?: (e: string) => void }).plausible?.(event)
  }
}
