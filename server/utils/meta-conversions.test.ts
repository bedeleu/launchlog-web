import { describe, expect, test } from 'bun:test'
import {
  buildMetaConversionPayload,
  postMetaConversion,
  resolveMetaConversionsCapability,
  sanitizeMetaConversionInput,
} from './meta-conversions'

const capabilityInput = {
  enabled: true,
  domain: 'launchlog.ai',
  pixelId: '123456789012345',
  accessToken: 'safe-test-token-with-more-than-20-chars',
  apiVersion: 'v25.0',
  testEventCode: '',
}

const eventId = '123e4567-e89b-42d3-a456-426614174000'

describe('Meta Conversions API boundary', () => {
  test('requires a complete private production capability', () => {
    expect(resolveMetaConversionsCapability(capabilityInput)).toEqual({
      origin: 'https://launchlog.ai',
      pixelId: '123456789012345',
      accessToken: capabilityInput.accessToken,
      apiVersion: 'v25.0',
      endpoint: 'https://graph.facebook.com/v25.0/123456789012345/events',
      testEventCode: null,
    })
    expect(resolveMetaConversionsCapability({
      ...capabilityInput,
      pixelId: 123456789012345,
    })?.pixelId).toBe('123456789012345')

    for (const input of [
      { ...capabilityInput, enabled: false },
      { ...capabilityInput, domain: 'preview.launchlog.ai' },
      { ...capabilityInput, pixelId: 'not-a-pixel' },
      { ...capabilityInput, accessToken: 'short' },
      { ...capabilityInput, apiVersion: 'latest' },
      { ...capabilityInput, apiVersion: 'v25.0?token=secret' },
      { ...capabilityInput, testEventCode: 'bad code' },
    ]) {
      expect(resolveMetaConversionsCapability(input)).toBeNull()
    }
  })

  test('accepts only consented known funnel events with bounded Meta cookie identifiers', () => {
    expect(sanitizeMetaConversionInput({
      event: 'Checkout Started',
      eventId,
      advertisingConsent: true,
      fbp: 'fb.1.1724926530000.1234567890',
      fbc: 'fb.1.1724926530000.AQz-safe_click-id',
      extra: 'blocked',
    })).toEqual({
      event: 'Checkout Started',
      eventId,
      fbp: 'fb.1.1724926530000.1234567890',
      fbc: 'fb.1.1724926530000.AQz-safe_click-id',
    })

    for (const input of [
      { event: 'Checkout Started', eventId, advertisingConsent: false },
      { event: 'Unknown Event', eventId, advertisingConsent: true },
      { event: 'Checkout Started', eventId: 'not-a-uuid', advertisingConsent: true },
      { event: 'Checkout Started', eventId, advertisingConsent: true, fbp: '<script>' },
      { event: 'Checkout Started', eventId, advertisingConsent: true, fbc: 'x'.repeat(501) },
    ]) {
      expect(sanitizeMetaConversionInput(input)).toBeNull()
    }
  })

  test('builds a minimal server event with a query-free source URL and no direct identity fields', () => {
    const capability = resolveMetaConversionsCapability({
      ...capabilityInput,
      testEventCode: 'TEST12345',
    })!
    const input = sanitizeMetaConversionInput({
      event: 'Listing Published',
      eventId,
      advertisingConsent: true,
      fbp: 'fb.1.1724926530000.1234567890',
    })!

    expect(buildMetaConversionPayload(
      input,
      capability,
      {
        clientIpAddress: '203.0.113.10',
        clientUserAgent: 'Mozilla/5.0 test browser',
        eventTime: 1_725_000_000,
      },
    )).toEqual({
      data: [{
        event_name: 'ListingPublished',
        event_time: 1_725_000_000,
        event_id: eventId,
        event_source_url: 'https://launchlog.ai/submit',
        action_source: 'website',
        user_data: {
          client_ip_address: '203.0.113.10',
          client_user_agent: 'Mozilla/5.0 test browser',
          fbp: 'fb.1.1724926530000.1234567890',
        },
      }],
      test_event_code: 'TEST12345',
    })
  })

  test('posts to the fixed Graph endpoint without putting the access token in the URL', async () => {
    const calls: Array<[string, RequestInit]> = []
    const capability = resolveMetaConversionsCapability(capabilityInput)!
    const payload = buildMetaConversionPayload(
      sanitizeMetaConversionInput({
        event: 'Preview Created',
        eventId,
        advertisingConsent: true,
      })!,
      capability,
      {
        clientIpAddress: '203.0.113.10',
        clientUserAgent: 'Mozilla/5.0 test browser',
        eventTime: 1_725_000_000,
      },
    )

    const sent = await postMetaConversion(payload, capability, async (url, init) => {
      calls.push([url, init])
      return { ok: true }
    })

    expect(sent).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.[0]).toBe(capability.endpoint)
    expect(calls[0]?.[0]).not.toContain(capability.accessToken)
    expect(calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: `Bearer ${capability.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    })
  })
})
