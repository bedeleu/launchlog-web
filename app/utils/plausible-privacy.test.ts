import { describe, expect, test } from 'bun:test'
import {
  FUNNEL_EVENTS,
  createPlausibleEventSender,
  postPlausibleEvent,
  resolvePlausibleCapability,
  safeFunnelEventUrl,
  sanitizePlausibleRequest,
  sanitizePublicAnalyticsUrl,
} from './plausible-privacy'

const enabled = {
  enabled: true,
  domain: 'launchlog.ai',
  endpoint: 'https://plausible.launchlog.ai/api/event',
}

const invalidCapabilities: Array<{
  enabled: unknown
  domain: unknown
  endpoint: unknown
}> = [
  { ...enabled, enabled: false },
  { ...enabled, enabled: 'true' },
  { ...enabled, domain: '' },
  { ...enabled, endpoint: 'http://plausible.launchlog.ai/api/event' },
  { ...enabled, endpoint: 'https://plausible.io/api/event' },
  { ...enabled, endpoint: `${enabled.endpoint}?token=secret` },
  { ...enabled, endpoint: 'https://user:secret@plausible.launchlog.ai/api/event' },
  { ...enabled, endpoint: 'https://plausible.launchlog.ai/js/pa-x.js' },
]

describe('Plausible privacy capability', () => {
  test('accepts only the complete self-hosted production tuple', () => {
    expect(resolvePlausibleCapability(enabled)).toEqual({
      origin: 'https://launchlog.ai',
      endpoint: enabled.endpoint,
    })
  })

  test.each(invalidCapabilities)('fails closed for an incomplete or unsafe tuple: %o', (input) => {
    expect(resolvePlausibleCapability(input)).toBeNull()
  })

  test('allows public routes and keeps only the complete deterministic Reddit UTM contract', () => {
    const capability = resolvePlausibleCapability(enabled)!

    expect(sanitizePublicAnalyticsUrl(
      '/submit?utm_source=reddit&utm_medium=paid_social&utm_campaign=reddit_founder_listing_test_01&utm_content=preview_before_pay&utm_term=community_founders&rdt_cid=private-click&preview=private-token&session_id=cs_secret',
      capability,
    )).toBe('https://launchlog.ai/submit?utm_source=reddit&utm_medium=paid_social&utm_campaign=reddit_founder_listing_test_01&utm_content=preview_before_pay&utm_term=community_founders')
    expect(sanitizePublicAnalyticsUrl('/listing/a-public-release', capability))
      .toBe('https://launchlog.ai/listing/a-public-release')
    expect(sanitizePublicAnalyticsUrl('/blog/a-public-post', capability))
      .toBe('https://launchlog.ai/blog/a-public-post')
  })

  test.each([
    '/preview/private-token',
    '/checkout/success?session_id=cs_secret',
    '/dashboard',
    '/admin/listings/42',
    '/login',
    '/withdrawal',
    '/ro/retragere',
    '/listing/not%2Fa-slug',
    '/definitely-not-a-route',
  ])('rejects a private or unknown route: %s', (path) => {
    expect(sanitizePublicAnalyticsUrl(path, resolvePlausibleCapability(enabled)!)).toBeNull()
  })

  test.each([
    '/contact',
    '/help',
    '/api-docs',
    '/status',
    '/privacy',
    '/terms',
    '/cookies',
    '/dmca',
    '/ro/privacy',
    '/ro/terms',
    '/ro/cookies',
  ])('preserves consented pageviews for every static public support/legal route: %s', (path) => {
    expect(sanitizePublicAnalyticsUrl(`${path}?private=discarded`, resolvePlausibleCapability(enabled)!))
      .toBe(`https://launchlog.ai${path}`)
  })

  test('rejects partial, duplicate, arbitrary and identifier-shaped attribution values', () => {
    const capability = resolvePlausibleCapability(enabled)!
    expect(sanitizePublicAnalyticsUrl('/submit?utm_source=reddit&utm_source=other', capability))
      .toBe('https://launchlog.ai/submit')
    expect(sanitizePublicAnalyticsUrl(`/submit?utm_campaign=${'x'.repeat(81)}`, capability))
      .toBe('https://launchlog.ai/submit')
    expect(sanitizePublicAnalyticsUrl('/submit?utm_source=reddit%20ads', capability))
      .toBe('https://launchlog.ai/submit')

    for (const privateValue of [
      'a'.repeat(64),
      'cs_test_private123',
      '123e4567-e89b-12d3-a456-426614174000',
    ]) {
      expect(sanitizePublicAnalyticsUrl(
        `/submit?utm_source=reddit&utm_medium=paid_social&utm_campaign=reddit_founder_listing_test_01&utm_content=${privateValue}&utm_term=community_founders`,
        capability,
      )).toBe('https://launchlog.ai/submit')
    }
  })

  test('removes referrer and automatic properties from every request', () => {
    const capability = resolvePlausibleCapability(enabled)!
    expect(sanitizePlausibleRequest({
      domain: 'launchlog.ai',
      name: 'pageview',
      url: 'https://launchlog.ai/submit?utm_source=reddit&rdt_cid=secret',
      referrer: 'https://launchlog.ai/preview/private-token',
      props: { url: 'https://launchlog.ai/checkout/success?session_id=secret' },
    }, capability)).toEqual({
      domain: 'launchlog.ai',
      name: 'pageview',
      url: 'https://launchlog.ai/submit',
    })
  })

  test('drops the entire request when its event URL is not public', () => {
    expect(sanitizePlausibleRequest({
      domain: 'launchlog.ai',
      name: 'pageview',
      url: 'https://launchlog.ai/preview/private-token',
    }, resolvePlausibleCapability(enabled)!)).toBeNull()
  })

  test('posts only the sanitized Events API payload without credentials or referrer', async () => {
    const calls: Array<[string, RequestInit]> = []
    const fetcher = async (url: string, init: RequestInit) => {
      calls.push([url, init])
      return { ok: true }
    }

    expect(await postPlausibleEvent({
      domain: 'launchlog.ai',
      name: 'Checkout Started',
      url: 'https://launchlog.ai/submit?utm_source=reddit&rdt_cid=secret',
      props: { private: 'blocked' },
    }, resolvePlausibleCapability(enabled)!, fetcher)).toBe(true)

    expect(calls).toHaveLength(1)
    expect(calls[0]?.[0]).toBe(enabled.endpoint)
    expect(calls[0]?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        domain: 'launchlog.ai',
        name: 'Checkout Started',
        url: 'https://launchlog.ai/submit',
      }),
    })
  })

  test('pins the existing funnel names to a query-free public event URL', () => {
    expect(FUNNEL_EVENTS).toEqual([
      'Preview Created',
      'Checkout Started',
      'Payment Canceled',
      'Listing Published',
    ])
    const capability = resolvePlausibleCapability(enabled)!
    for (const event of FUNNEL_EVENTS) {
      expect(safeFunnelEventUrl(event, capability)).toBe('https://launchlog.ai/submit')
    }
  })

  test('rejects the reserved server-authoritative publication goal from browser transport', async () => {
    const calls: Array<[string, RequestInit]> = []
    const capability = resolvePlausibleCapability(enabled)!

    expect(sanitizePlausibleRequest({
      domain: 'launchlog.ai',
      name: 'Listing Published',
      url: 'https://launchlog.ai/submit',
    }, capability)).toBeNull()

    const sender = createPlausibleEventSender(
      capability,
      async (url, init) => {
        calls.push([url, init])
        return { ok: true }
      },
      () => true,
    )
    sender.enable()
    sender.send('Listing Published', '/submit')

    expect(calls).toHaveLength(0)
  })

  test('sends only while enabled and aborts in-flight work on withdrawal', () => {
    const calls: RequestInit[] = []
    let consentStillStored = true
    const sender = createPlausibleEventSender(
      resolvePlausibleCapability(enabled)!,
      async (_url, init) => {
        calls.push(init)
        return { ok: true }
      },
      () => consentStillStored,
    )

    sender.send('pageview', '/submit')
    expect(calls).toHaveLength(0)

    sender.enable()
    sender.send('pageview', '/submit?utm_source=reddit&rdt_cid=secret')
    expect(calls).toHaveLength(1)
    const firstSignal = calls[0]?.signal
    expect(firstSignal?.aborted).toBe(false)

    sender.disable()
    expect(firstSignal?.aborted).toBe(true)
    sender.send('pageview', '/pricing')
    expect(calls).toHaveLength(1)

    sender.enable()
    sender.send('Preview Created', '/submit')
    expect(calls).toHaveLength(2)
    expect(calls[1]?.signal).not.toBe(firstSignal)

    consentStillStored = false
    sender.send('pageview', '/pricing')
    expect(calls).toHaveLength(2)
  })
})
