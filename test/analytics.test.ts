import { afterEach, describe, expect, mock, test } from 'bun:test'
import { track } from '../app/utils/analytics'

// import.meta.client is true under bun's happy-path env for these units; the
// guard is exercised by asserting the queue receives the exact event name.
describe('track (Plausible funnel)', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  test('forwards the event name to window.plausible when present', () => {
    const spy = mock((_e: string) => {})
    ;(globalThis as { window?: unknown }).window = { plausible: spy }

    track('Checkout Started')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toBe('Checkout Started')
  })

  test('is a no-op when window.plausible is absent', () => {
    ;(globalThis as { window?: unknown }).window = {}
    expect(() => track('Preview Created')).not.toThrow()
  })
})
