import { describe, expect, mock, test } from 'bun:test'
import {
  checkoutReturnMarkerKey,
  clearCheckoutReturnMarker,
  hasCheckoutReturnMarker,
  markCheckoutRedirect,
  reconcileCancelledCheckout,
} from './checkout-cancellation'

describe('Stripe Back reconciliation', () => {
  test('cancels the saved checkout and removes the cancelled query after success', async () => {
    const reservedPreview = { checkout_reserved: true, tier: 'featured' }
    const preview = { checkout_reserved: false, tier: 'featured' }
    const refresh = mock(async () => reservedPreview)
    const cancel = mock(async () => preview)
    const clearReturnState = mock(async () => {})

    const result = await reconcileCancelledCheckout({
      returnedFromCheckout: true,
      refresh,
      isCheckoutReserved: current => current.checkout_reserved,
      cancel,
      clearReturnState,
    })

    expect(result).toEqual({ state: 'done', preview })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(clearReturnState).toHaveBeenCalledTimes(1)
  })

  test('refreshes stale page state before deciding whether browser Back needs cancellation', async () => {
    const reservedPreview = { checkout_reserved: true, tier: 'standard' }
    const preview = { checkout_reserved: false, tier: 'standard' }
    const refresh = mock(async () => reservedPreview)
    const cancel = mock(async () => preview)
    const clearReturnState = mock(async () => {})

    const result = await reconcileCancelledCheckout({
      returnedFromCheckout: true,
      refresh,
      isCheckoutReserved: current => current.checkout_reserved,
      cancel,
      clearReturnState,
    })

    expect(result).toEqual({ state: 'done', preview })
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  test('cleans stale return state without issuing another cancellation', async () => {
    const preview = { checkout_reserved: false }
    const refresh = mock(async () => preview)
    const cancel = mock(async () => ({ checkout_reserved: false }))
    const clearReturnState = mock(async () => {})

    const result = await reconcileCancelledCheckout({
      returnedFromCheckout: true,
      refresh,
      isCheckoutReserved: current => current.checkout_reserved,
      cancel,
      clearReturnState,
    })

    expect(result).toEqual({ state: 'done', preview })
    expect(cancel).toHaveBeenCalledTimes(0)
    expect(clearReturnState).toHaveBeenCalledTimes(1)
  })

  test('keeps the query and reports an error when cancellation is not confirmed', async () => {
    const cancel = mock(async () => {
      throw new Error('provider unavailable')
    })
    const refresh = mock(async () => ({ checkout_reserved: true }))
    const clearReturnState = mock(async () => {})

    const result = await reconcileCancelledCheckout({
      returnedFromCheckout: true,
      refresh,
      isCheckoutReserved: current => current.checkout_reserved,
      cancel,
      clearReturnState,
    })

    expect(result).toEqual({ state: 'error' })
    expect(clearReturnState).toHaveBeenCalledTimes(0)
  })

  test('does nothing outside the Stripe cancel return path', async () => {
    const refresh = mock(async () => ({ checkout_reserved: true }))
    const cancel = mock(async () => ({ checkout_reserved: false }))
    const clearReturnState = mock(async () => {})

    const result = await reconcileCancelledCheckout({
      returnedFromCheckout: false,
      refresh,
      isCheckoutReserved: current => current.checkout_reserved,
      cancel,
      clearReturnState,
    })

    expect(result).toEqual({ state: 'idle' })
    expect(refresh).toHaveBeenCalledTimes(0)
    expect(cancel).toHaveBeenCalledTimes(0)
    expect(clearReturnState).toHaveBeenCalledTimes(0)
  })

  test('keeps a per-tab marker from redirect until cancellation is reconciled', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    }

    expect(checkoutReturnMarkerKey('preview-token')).toBe('launchlog:checkout-return:preview-token')
    expect(hasCheckoutReturnMarker(storage, 'preview-token')).toBe(false)

    markCheckoutRedirect(storage, 'preview-token')
    expect(hasCheckoutReturnMarker(storage, 'preview-token')).toBe(true)

    clearCheckoutReturnMarker(storage, 'preview-token')
    expect(hasCheckoutReturnMarker(storage, 'preview-token')).toBe(false)
  })
})
