import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  outreachDeliveryStatuses,
  useOutreachSend,
} from './useOutreachSend'

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
  test('posts every structured field and returns the validated full resource', async () => {
    const result = await useOutreachSend().send({
      recipientEmail: 'founder@example.com',
      firstName: 'Maya',
      productName: 'ShipFast',
      sourceName: 'Product Hunt',
      subjectVariant: 'preview',
      subject: 'I made a private LaunchLog preview for ShipFast',
      text: 'Exact body',
      previewUrl,
      requestId,
    })

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

  test('rejects a malformed full resource before returning it', async () => {
    globals.$fetch = () => Promise.resolve({
      data: {
        ...sendResource,
        provider_email_id: 123,
        status: 'accepted',
      },
    })

    await expect(useOutreachSend().send({
      recipientEmail: 'founder@example.com',
      firstName: 'Maya',
      productName: 'ShipFast',
      sourceName: 'Product Hunt',
      subjectVariant: 'preview',
      subject: 'Hello',
      text: 'Body',
      previewUrl,
      requestId,
    })).rejects.toThrow('Invalid outreach delivery response')
  })

  test('rejects a valid resource whose request id does not match the request', async () => {
    globals.$fetch = () => Promise.resolve({
      data: {
        ...sendResource,
        request_id: 'c47e38cb-d26d-47d4-8643-50ef871f059f',
      },
    })

    await expect(useOutreachSend().send({
      recipientEmail: 'founder@example.com',
      firstName: 'Maya',
      productName: 'ShipFast',
      sourceName: 'Product Hunt',
      subjectVariant: 'preview',
      subject: 'Hello',
      text: 'Body',
      previewUrl,
      requestId,
    })).rejects.toThrow('Invalid outreach delivery response')
  })
})
