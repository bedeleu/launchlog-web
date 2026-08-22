import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { useBilling } from './useBilling'

const API = 'https://api.launchlog.test'

type FetchCall = { url: string, options: Record<string, unknown> | undefined }

const globals = globalThis as unknown as Record<string, unknown>
let calls: FetchCall[] = []
let respond: (url: string) => unknown

/**
 * useBilling relies on Nuxt's auto-imported globals ($fetch, useRuntimeConfig).
 * bun test runs outside Nuxt, so the globals are stubbed here — no new test
 * dependency, and the composable stays free of test-only seams.
 */
beforeEach(() => {
  calls = []
  respond = () => ({ data: {} })
  globals.useRuntimeConfig = () => ({ public: { apiUrl: API } })
  globals.useAuth = () => ({ getIdToken: () => Promise.resolve(null) })
  globals.$fetch = (url: string, options?: Record<string, unknown>) => {
    calls.push({ url, options })
    return Promise.resolve(respond(url))
  }
})

afterEach(() => {
  delete globals.$fetch
  delete globals.useRuntimeConfig
  delete globals.useAuth
})

describe('createSession', () => {
  test('posts the exact checkout contract and unwraps the data envelope', async () => {
    respond = () => ({ data: { session_id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' } })

    const session = await useBilling().createSession({
      preview_token: 't'.repeat(64),
      tier: 'featured',
      email: 'maker@example.com',
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe(`${API}/api/v1/checkout/session`)
    expect(calls[0]!.options?.method).toBe('POST')
    expect(calls[0]!.options?.body).toEqual({
      preview_token: 't'.repeat(64),
      tier: 'featured',
      email: 'maker@example.com',
    })
    expect(session).toEqual({
      session_id: 'cs_test_1',
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
    })
  })

  test('propagates API failures instead of swallowing them', async () => {
    globals.$fetch = () => Promise.reject(new Error('checkout unavailable'))

    await expect(useBilling().createSession({
      preview_token: 't'.repeat(64),
      tier: 'basic',
      email: 'maker@example.com',
    })).rejects.toThrow('checkout unavailable')
  })

  test('uses verified Firebase identity instead of sending an editable email when signed in', async () => {
    globals.useAuth = () => ({ getIdToken: () => Promise.resolve('firebase-id-token') })
    respond = () => ({ data: { session_id: 'cs_test_auth', url: 'https://checkout.stripe.com/c/pay/cs_test_auth' } })

    await useBilling().createSession({
      preview_token: 'a'.repeat(64),
      tier: 'basic',
      email: 'typed-different@example.com',
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]!.options?.headers).toEqual({
      Authorization: 'Bearer firebase-id-token',
    })
    expect(calls[0]!.options?.body).toEqual({
      preview_token: 'a'.repeat(64),
      tier: 'basic',
    })
  })
})

describe('getConversion', () => {
  test('gets the exact conversion endpoint and unwraps the data envelope', async () => {
    respond = () => ({ data: { status: 'converted', listing_slug: 'acme-tool' } })

    const status = await useBilling().getConversion('abc123')

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe(`${API}/api/v1/previews/abc123/conversion`)
    // A plain GET: no method override, no body.
    expect(calls[0]!.options?.method).toBeUndefined()
    expect(calls[0]!.options?.body).toBeUndefined()
    expect(status).toEqual({ status: 'converted', listing_slug: 'acme-tool' })
  })

  test('forwards the abort signal to $fetch so a caller can enforce a deadline', async () => {
    respond = () => ({ data: { status: 'pending', listing_slug: null } })
    const controller = new AbortController()

    await useBilling().getConversion('tok', controller.signal)

    expect(calls).toHaveLength(1)
    expect(calls[0]!.options?.signal).toBe(controller.signal)
  })

  test('omits the signal entirely when no caller supplies one', async () => {
    respond = () => ({ data: { status: 'pending', listing_slug: null } })

    await useBilling().getConversion('tok')

    expect(calls[0]!.options?.signal).toBeUndefined()
  })

  test('returns pending and expired statuses verbatim', async () => {
    respond = () => ({ data: { status: 'pending', listing_slug: null } })
    expect(await useBilling().getConversion('tok')).toEqual({ status: 'pending', listing_slug: null })

    respond = () => ({ data: { status: 'expired', listing_slug: null } })
    expect(await useBilling().getConversion('tok')).toEqual({ status: 'expired', listing_slug: null })
  })

  test('propagates API failures instead of swallowing them', async () => {
    globals.$fetch = () => Promise.reject(new Error('conversion lookup failed'))

    await expect(useBilling().getConversion('tok')).rejects.toThrow('conversion lookup failed')
  })
})
