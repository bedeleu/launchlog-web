import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { parseStripeCheckoutSession, useBilling } from './useBilling'

const API = 'https://api.launchlog.test'

type FetchCall = { url: string, options: Record<string, unknown> | undefined }

const globals = globalThis as unknown as Record<string, unknown>
let calls: FetchCall[] = []
let respond: (url: string) => unknown
const legalDecisions = {
  terms_accepted: true,
  terms_version: '2026-08-29',
  immediate_performance_requested: true,
  performance_notice_version: '2026-08-29',
  legal_locale: 'en' as const,
  checkout_capability_version: '2026-08-29.1',
  checkout_capability_sha256: 'a'.repeat(64),
  provider_sha256: 'b'.repeat(64),
  offer_catalog_sha256: 'c'.repeat(64),
  terms_document_sha256: 'd'.repeat(64),
}
const capabilityData = () => ({
  schema_version: '1',
  capability_version: '2026-08-29.1',
  capability_sha256: 'a'.repeat(64),
  checkout_enabled: true,
  provider: {
    legal_name: 'Registered provider', legal_address: 'Timișoara 300369, Romania',
    registration_id: 'J35/0000/2026', tax_id: '12345678',
    phone: '+40 000 000 000', email: 'legal@example.com',
  },
  provider_sha256: 'b'.repeat(64),
  offers: Object.fromEntries(['basic', 'featured'].map((tier, index) => [tier, {
    tier, name: index === 0 ? 'Standard' : 'Featured', amount_minor: index === 0 ? 2499 : 9900,
    currency: 'USD', interval: 'year', interval_count: 1, quantity: 1,
    stripe_price_id: `price_${tier}`, stripe_price_tax_behavior: 'exclusive', automatic_tax_enabled: false,
    notices: {
      en: { tax: 'Tax EN', renewal: 'Renewal EN', cancellation: 'Cancellation EN', voluntary_refund: 'Refund EN' },
      ro: { tax: 'Taxă RO', renewal: 'Reînnoire RO', cancellation: 'Anulare RO', voluntary_refund: 'Rambursare RO' },
    },
  }])),
  offer_catalog_sha256: 'c'.repeat(64),
  legal: {
    terms_version: '2026-08-29', performance_notice_version: '2026-08-29',
    locales: {
      en: { url: 'https://launchlog.ai/terms', document: 'Terms EN', document_sha256: 'd'.repeat(64), acceptance_text: 'Accept EN', performance_request_text: 'Perform EN' },
      ro: { url: 'https://launchlog.ai/ro/terms', document: 'Termeni RO', document_sha256: 'e'.repeat(64), acceptance_text: 'Accept RO', performance_request_text: 'Executare RO' },
    },
  },
})

/**
 * useBilling relies on Nuxt's auto-imported globals ($fetch, useRuntimeConfig).
 * bun test runs outside Nuxt, so the globals are stubbed here — no new test
 * dependency, and the composable stays free of test-only seams.
 */
beforeEach(() => {
  calls = []
  respond = () => ({ data: {} })
  globals.useRuntimeConfig = () => ({ public: { apiUrl: API, domain: 'launchlog.ai' } })
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
    respond = () => ({ data: { session_id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1', agreement_reference: `lla_${'a'.repeat(26)}`, created_new_session: true } })

    const session = await useBilling().createSession({
      preview_token: 't'.repeat(64),
      tier: 'featured',
      email: 'maker@example.com',
      ...legalDecisions,
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe(`${API}/api/v1/checkout/session`)
    expect(calls[0]!.options?.method).toBe('POST')
    expect(calls[0]!.options?.body).toEqual({
      preview_token: 't'.repeat(64),
      tier: 'featured',
      email: 'maker@example.com',
      ...legalDecisions,
    })
    expect(session).toEqual({
      session_id: 'cs_test_1',
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
      agreement_reference: `lla_${'a'.repeat(26)}`,
      created_new_session: true,
    })
  })

  test('propagates API failures instead of swallowing them', async () => {
    globals.$fetch = () => Promise.reject(new Error('checkout unavailable'))

    await expect(useBilling().createSession({
      preview_token: 't'.repeat(64),
      tier: 'basic',
      email: 'maker@example.com',
      ...legalDecisions,
    })).rejects.toThrow('checkout unavailable')
  })

  test('uses verified Firebase identity instead of sending an editable email when signed in', async () => {
    globals.useAuth = () => ({ getIdToken: () => Promise.resolve('firebase-id-token') })
    respond = () => ({ data: { session_id: 'cs_test_auth', url: 'https://checkout.stripe.com/c/pay/cs_test_auth', agreement_reference: `lla_${'b'.repeat(26)}`, created_new_session: false } })

    await useBilling().createSession({
      preview_token: 'a'.repeat(64),
      tier: 'basic',
      email: 'typed-different@example.com',
      ...legalDecisions,
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]!.options?.headers).toEqual({
      Authorization: 'Bearer firebase-id-token',
    })
    expect(calls[0]!.options?.body).toEqual({
      preview_token: 'a'.repeat(64),
      tier: 'basic',
      ...legalDecisions,
    })
  })

  test('fails closed for a malformed session or a redirect outside exact Stripe Checkout', async () => {
    for (const data of [
      { session_id: 'cs_test_safe', url: 'javascript:alert(1)', agreement_reference: `lla_${'a'.repeat(26)}`, created_new_session: true },
      { session_id: 'cs_test_safe', url: 'https://checkout.stripe.com.evil.example/c/pay/cs_test_safe', agreement_reference: `lla_${'a'.repeat(26)}`, created_new_session: true },
      { session_id: 'cs_test_safe', url: 'https://checkout.stripe.com:444/c/pay/cs_test_safe', agreement_reference: `lla_${'a'.repeat(26)}`, created_new_session: true },
      { session_id: 'cs_test_safe', url: 'https://checkout.stripe.com/c/pay/cs_test_other', agreement_reference: `lla_${'a'.repeat(26)}`, created_new_session: true },
      { session_id: 'not-a-session', url: 'https://checkout.stripe.com/c/pay/not-a-session', agreement_reference: `lla_${'a'.repeat(26)}`, created_new_session: true },
      { session_id: 'cs_test_safe', url: 'https://checkout.stripe.com/c/pay/cs_test_safe', agreement_reference: 'invalid', created_new_session: true },
      { session_id: 'cs_test_safe', url: 'https://checkout.stripe.com/c/pay/cs_test_safe', agreement_reference: `lla_${'a'.repeat(26)}` },
    ]) {
      respond = () => ({ data })
      await expect(useBilling().createSession({
        preview_token: 't'.repeat(64),
        tier: 'basic',
        email: 'maker@example.com',
        ...legalDecisions,
      })).rejects.toThrow('invalid session')
    }
  })

  test('normalizes a validated Stripe Checkout URL without trusting extra response fields', () => {
    expect(parseStripeCheckoutSession({
      session_id: 'cs_live_abc123',
      url: 'https://checkout.stripe.com/c/pay/cs_live_abc123#provider-state',
      agreement_reference: `lla_${'c'.repeat(26)}`,
      created_new_session: false,
      ignored: 'not returned',
    })).toEqual({
      session_id: 'cs_live_abc123',
      url: 'https://checkout.stripe.com/c/pay/cs_live_abc123#provider-state',
      agreement_reference: `lla_${'c'.repeat(26)}`,
      created_new_session: false,
    })
  })
})

describe('getCheckoutCapability', () => {
  test('gets the public capability endpoint and parses its data envelope', async () => {
    respond = () => ({ data: capabilityData() })

    const capability = await useBilling().getCheckoutCapability()

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe(`${API}/api/v1/checkout/capability`)
    expect(capability.capability_version).toBe('2026-08-29.1')
    expect(capability.legal.locales.ro.acceptance_text).toBe('Accept RO')
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
