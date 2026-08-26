export type CheckoutCancellationResult<T> =
  | { state: 'idle' }
  | { state: 'done', preview?: T }
  | { state: 'error' }

interface ReconcileCancelledCheckoutOptions<T> {
  returnedFromCheckout: boolean
  checkoutReserved: boolean
  cancel: () => Promise<T>
  clearCancelledQuery: () => Promise<void>
}

export const reconcileCancelledCheckout = async <T>({
  returnedFromCheckout,
  checkoutReserved,
  cancel,
  clearCancelledQuery,
}: ReconcileCancelledCheckoutOptions<T>): Promise<CheckoutCancellationResult<T>> => {
  if (!returnedFromCheckout) return { state: 'idle' }

  try {
    if (!checkoutReserved) {
      await clearCancelledQuery()
      return { state: 'done' }
    }

    const preview = await cancel()
    await clearCancelledQuery()

    return { state: 'done', preview }
  }
  catch {
    return { state: 'error' }
  }
}
