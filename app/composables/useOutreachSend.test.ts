import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as outreachSendModule from './useOutreachSend'
import type {
  OutreachSendPayload,
} from './useOutreachSend'

const {
  outreachDeliveryStatuses,
  useOutreachSend,
} = outreachSendModule
const parseIsoOffsetToMicroseconds = (value: string): bigint | null => {
  const parser = (outreachSendModule as unknown as {
    parseIsoOffsetToMicroseconds?: (timestamp: string) => bigint | null
  }).parseIsoOffsetToMicroseconds
  return parser?.(value) ?? null
}

const globals = globalThis as unknown as Record<string, unknown>
const calls: Array<{ url: string, options?: Record<string, unknown> }> = []
const requestId = '8adf6d21-2bc6-4c96-8dd6-e17f83956275'
const previewUrl = `https://launchlog.ai/preview/${'A'.repeat(64)}`

const sendResource = {
  id: 'f642097d-9070-4e00-b2e7-00f0e0e4ea6a',
  request_id: requestId,
  recipient_email: 'founder@example.com',
  first_name: 'Maya',
  product_name: 'ShipFast',
  source_name: 'Product Hunt',
  subject_variant: 'preview',
  subject: 'I made a private LaunchLog preview for ShipFast',
  text: 'Exact body',
  preview_url: previewUrl,
  from_address: 'alex@launchlog.ai',
  from_name: 'Alex from LaunchLog',
  reply_to_address: 'alex@launchlog.ai',
  delivery_channel: 'resend',
  provider_email_id: 'email_outreach_1',
  status: 'accepted',
  accepted_at: '2026-08-30T12:00:00Z',
  provider_event_at: null,
  last_synced_at: null,
  diagnostic_code: null,
  created_at: '2026-08-30T11:59:59Z',
  updated_at: '2026-08-30T12:00:00Z',
} as const

const sendPayload = {
  recipientEmail: 'founder@example.com',
  firstName: 'Maya',
  productName: 'ShipFast',
  sourceName: 'Product Hunt',
  subjectVariant: 'preview',
  subject: 'I made a private LaunchLog preview for ShipFast',
  text: 'Exact body',
  previewUrl,
  requestId,
} satisfies OutreachSendPayload

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? (<Value>() => Value extends Right ? 1 : 2) extends
      (<Value>() => Value extends Left ? 1 : 2)
      ? true
      : false
    : false

type SendParameter = Parameters<ReturnType<typeof useOutreachSend>['send']>[0]
const sendUsesOnlyCompletePayload: Equal<SendParameter, OutreachSendPayload> = true

describe('strict ISO-offset instants', () => {
  test('exports one shared strict instant parser', () => {
    expect('parseIsoOffsetToMicroseconds' in outreachSendModule).toBe(true)
  })

  test('returns exact microseconds for fractions and normalized maximum offsets', () => {
    const cases = [
      ['1970-01-01T00:00:00Z', 0n],
      ['1970-01-01T00:00:00.1Z', 100_000n],
      ['1970-01-01T00:00:00.000001+00:00', 1n],
      ['1970-01-01T01:00:00+01:00', 0n],
      ['1969-12-31T23:00:00-01:00', 0n],
      ['1970-01-01T23:59:00+23:59', 0n],
      ['1969-12-31T00:01:00-23:59', 0n],
    ] as const

    for (const [value, expected] of cases) {
      expect(parseIsoOffsetToMicroseconds(value)).toBe(expected)
    }
  })

  test('preserves proleptic years 0000 through 0099 without 1900 coercion', () => {
    expect(parseIsoOffsetToMicroseconds('0000-01-01T00:00:00Z'))
      .toBe(-62_167_219_200_000_000n)
    expect(parseIsoOffsetToMicroseconds('0001-01-01T00:00:00Z'))
      .toBe(-62_135_596_800_000_000n)
    expect(parseIsoOffsetToMicroseconds('0099-01-01T00:00:00Z'))
      .toBe(-59_042_995_200_000_000n)
    expect(parseIsoOffsetToMicroseconds('0099-01-01T00:00:00+01:00'))
      .toBe(-59_042_998_800_000_000n)

    const yearOne = parseIsoOffsetToMicroseconds('0001-12-31T23:59:59.999999Z')
    const yearNinetyNine = parseIsoOffsetToMicroseconds('0099-01-01T00:00:00+23:59')
    expect(yearOne).not.toBeNull()
    expect(yearNinetyNine).not.toBeNull()
    expect(yearOne! < yearNinetyNine!).toBe(true)
  })

  test('accepts real Gregorian leap days and rejects invalid calendar or clock fields', () => {
    expect(parseIsoOffsetToMicroseconds('2000-02-29T23:59:59.999999Z')).not.toBeNull()
    expect(parseIsoOffsetToMicroseconds('0000-02-29T00:00:00Z')).not.toBeNull()

    const invalidValues = [
      '2026-00-01T00:00:00Z',
      '2026-13-01T00:00:00Z',
      '2026-01-00T00:00:00Z',
      '2026-01-32T00:00:00Z',
      '2026-04-31T00:00:00Z',
      '2025-02-29T00:00:00Z',
      '1900-02-29T00:00:00Z',
      '2026-01-01T24:00:00Z',
      '2026-01-01T00:60:00Z',
      '2026-01-01T00:00:60Z',
      '2026-01-01T00:00:00+24:00',
      '2026-01-01T00:00:00-24:00',
      '2026-01-01T00:00:00+01:60',
    ]

    for (const value of invalidValues) {
      expect(parseIsoOffsetToMicroseconds(value)).toBeNull()
    }
  })

  test('rejects non-exact formats and precision beyond six fractional digits', () => {
    const invalidValues = [
      '2026-01-01 00:00:00Z',
      '2026-1-01T00:00:00Z',
      '2026-01-01T0:00:00Z',
      '2026-01-01T00:00Z',
      '2026-01-01T00:00:00',
      '2026-01-01T00:00:00z',
      '2026-01-01T00:00:00.',
      '2026-01-01T00:00:00.0000000Z',
      '2026-01-01T00:00:00+0100',
      '2026-01-01T00:00:00+1:00',
    ]

    for (const value of invalidValues) {
      expect(parseIsoOffsetToMicroseconds(value)).toBeNull()
    }
  })
})

beforeEach(() => {
  calls.length = 0
  globals.useRuntimeConfig = () => ({ public: { apiUrl: 'https://api.launchlog.test' } })
  globals.useAuth = () => ({ getIdToken: async () => 'firebase-admin-token' })
  globals.$fetch = (url: string, options?: Record<string, unknown>) => {
    calls.push({ url, options })
    return Promise.resolve({
      data: sendResource,
      message: 'Email accepted for delivery.',
    })
  }
})

afterEach(() => {
  delete globals.useRuntimeConfig
  delete globals.useAuth
  delete globals.$fetch
})

describe('outreach send client', () => {
  test('exposes only the complete structured payload contract', () => {
    expect(sendUsesOnlyCompletePayload).toBe(true)
  })

  test('posts every structured field and returns the validated full resource', async () => {
    const result = await useOutreachSend().send(sendPayload)

    expect(result).toEqual(sendResource)
    expect(calls).toEqual([{
      url: 'https://api.launchlog.test/api/v1/admin/outreach/send',
      options: {
        method: 'POST',
        headers: { Authorization: 'Bearer firebase-admin-token' },
        body: {
          recipient_email: 'founder@example.com',
          first_name: 'Maya',
          product_name: 'ShipFast',
          source_name: 'Product Hunt',
          subject_variant: 'preview',
          subject: 'I made a private LaunchLog preview for ShipFast',
          text: 'Exact body',
          preview_url: previewUrl,
          request_id: requestId,
        },
      },
    }])
  })

  test('matches the complete API delivery enum including pending', () => {
    expect(outreachDeliveryStatuses).toEqual([
      'pending',
      'accepted',
      'sent',
      'delivered',
      'delivery_delayed',
      'bounced',
      'complained',
      'failed',
      'suppressed',
      'canceled',
      'scheduled',
      'opened',
      'clicked',
      'unknown',
    ])
  })

  test('fails before the request when Firebase has no token', async () => {
    globals.useAuth = () => ({ getIdToken: async () => null })

    await expect(useOutreachSend().send({
      recipientEmail: 'founder@example.com',
      firstName: null,
      productName: 'ShipFast',
      sourceName: 'Product Hunt',
      subjectVariant: 'fit',
      subject: 'Hello',
      text: 'Body',
      previewUrl: null,
      requestId: crypto.randomUUID(),
    })).rejects.toThrow('Not authenticated')

    expect(calls).toHaveLength(0)
  })

  test('accepts a null response preview URL', async () => {
    globals.$fetch = () => Promise.resolve({
      data: {
        ...sendResource,
        preview_url: null,
      },
    })

    const result = await useOutreachSend().send({
      ...sendPayload,
      previewUrl: null,
    })

    expect(result.preview_url).toBeNull()
  })

  test('rejects every non-canonical response preview URL', async () => {
    const invalidPreviewUrls = [
      'javascript:alert(1)',
      `https://external.example/preview/${'A'.repeat(64)}`,
      `https://founder:secret@launchlog.ai/preview/${'A'.repeat(64)}`,
      `${previewUrl}?source=outreach`,
      `${previewUrl}#private`,
      `https://launchlog.ai/path/../preview/${'A'.repeat(64)}`,
    ]

    for (const invalidPreviewUrl of invalidPreviewUrls) {
      globals.$fetch = () => Promise.resolve({
        data: {
          ...sendResource,
          preview_url: invalidPreviewUrl,
        },
      })

      await expect(useOutreachSend().send(sendPayload))
        .rejects.toThrow('Invalid outreach delivery response')
    }
  })

  test('rejects a malformed full resource before returning it', async () => {
    globals.$fetch = () => Promise.resolve({
      data: {
        ...sendResource,
        provider_email_id: 123,
        status: 'accepted',
      },
    })

    await expect(useOutreachSend().send({
      ...sendPayload,
      subject: 'Hello',
      text: 'Body',
    })).rejects.toThrow('Invalid outreach delivery response')
  })

  test('rejects malformed timestamps from the network at the shared Zod boundary', async () => {
    const malformedResources = [
      { ...sendResource, created_at: '2026-02-30T12:00:00Z' },
      { ...sendResource, updated_at: '2026-08-30T24:00:00Z' },
      { ...sendResource, accepted_at: '2026-08-30T12:00:60Z' },
      { ...sendResource, provider_event_at: '2026-08-30T12:00:00.0000000Z' },
      { ...sendResource, last_synced_at: '2026-08-30T12:00:00+01:60' },
    ]

    for (const malformedResource of malformedResources) {
      globals.$fetch = () => Promise.resolve({ data: malformedResource })
      await expect(useOutreachSend().send(sendPayload))
        .rejects.toThrow('Invalid outreach delivery response')
    }
  })

  test('rejects a valid resource whose request id does not match the request', async () => {
    globals.$fetch = () => Promise.resolve({
      data: {
        ...sendResource,
        request_id: 'c47e38cb-d26d-47d4-8643-50ef871f059f',
      },
    })

    await expect(useOutreachSend().send({
      ...sendPayload,
      subject: 'Hello',
      text: 'Body',
    })).rejects.toThrow('Invalid outreach delivery response')
  })
})
