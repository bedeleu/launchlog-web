export type CheckoutCancellationResult<T> =
  | { state: 'idle' }
  | { state: 'done', preview: T, cancelled: boolean }
  | { state: 'error' }

interface ReconcileCancelledCheckoutOptions<T> {
  returnedFromCheckout: boolean
  refresh: () => Promise<T>
  isCheckoutReserved: (preview: T) => boolean
  cancel: () => Promise<T>
  clearReturnState: () => Promise<void>
}

interface CheckoutReturnStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export const checkoutReturnMarkerKey = (token: string) => `launchlog:checkout-return:${token}`

export const markCheckoutRedirect = (storage: CheckoutReturnStorage | null, token: string) => {
  try {
    storage?.setItem(checkoutReturnMarkerKey(token), '1')
  }
  catch {
    // Stripe's explicit cancel URL remains the fallback when storage is blocked.
  }
}

export const hasCheckoutReturnMarker = (storage: CheckoutReturnStorage | null, token: string) => {
  try {
    return storage?.getItem(checkoutReturnMarkerKey(token)) === '1'
  }
  catch {
    return false
  }
}

export const clearCheckoutReturnMarker = (storage: CheckoutReturnStorage | null, token: string) => {
  try {
    storage?.removeItem(checkoutReturnMarkerKey(token))
  }
  catch {
    // A stale marker is harmless: the next reconciliation refreshes first.
  }
}

export const reconcileCancelledCheckout = async <T>({
  returnedFromCheckout,
  refresh,
  isCheckoutReserved,
  cancel,
  clearReturnState,
}: ReconcileCancelledCheckoutOptions<T>): Promise<CheckoutCancellationResult<T>> => {
  if (!returnedFromCheckout) return { state: 'idle' }

  try {
    const current = await refresh()
    const wasReserved = isCheckoutReserved(current)
    const preview = wasReserved ? await cancel() : current

    await clearReturnState()

    return { state: 'done', preview, cancelled: wasReserved }
  }
  catch {
    return { state: 'error' }
  }
}
