import { describe, expect, mock, test } from 'bun:test'
import { reconcileCancelledCheckout } from './checkout-cancellation'

describe('Stripe Back reconciliation', () => {
  test('cancels the saved checkout and removes the cancelled query after success', async () => {
    const preview = { checkout_reserved: false, tier: 'featured' }
    const cancel = mock(async () => preview)
    const clearCancelledQuery = mock(async () => {})

    const result = await reconcileCancelledCheckout({
      returnedFromCheckout: true,
      checkoutReserved: true,
      cancel,
      clearCancelledQuery,
    })

    expect(result).toEqual({ state: 'done', preview })
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(clearCancelledQuery).toHaveBeenCalledTimes(1)
  })

  test('cleans a stale cancelled query without issuing another cancellation', async () => {
    const cancel = mock(async () => ({ checkout_reserved: false }))
    const clearCancelledQuery = mock(async () => {})

    const result = await reconcileCancelledCheckout({
      returnedFromCheckout: true,
      checkoutReserved: false,
      cancel,
      clearCancelledQuery,
    })

    expect(result).toEqual({ state: 'done' })
    expect(cancel).toHaveBeenCalledTimes(0)
    expect(clearCancelledQuery).toHaveBeenCalledTimes(1)
  })

  test('keeps the query and reports an error when cancellation is not confirmed', async () => {
    const cancel = mock(async () => {
      throw new Error('provider unavailable')
    })
    const clearCancelledQuery = mock(async () => {})

    const result = await reconcileCancelledCheckout({
      returnedFromCheckout: true,
      checkoutReserved: true,
      cancel,
      clearCancelledQuery,
    })

    expect(result).toEqual({ state: 'error' })
    expect(clearCancelledQuery).toHaveBeenCalledTimes(0)
  })

  test('does nothing outside the Stripe cancel return path', async () => {
    const cancel = mock(async () => ({ checkout_reserved: false }))
    const clearCancelledQuery = mock(async () => {})

    const result = await reconcileCancelledCheckout({
      returnedFromCheckout: false,
      checkoutReserved: true,
      cancel,
      clearCancelledQuery,
    })

    expect(result).toEqual({ state: 'idle' })
    expect(cancel).toHaveBeenCalledTimes(0)
    expect(clearCancelledQuery).toHaveBeenCalledTimes(0)
  })
})
