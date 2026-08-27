import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { useOutreachSend } from './useOutreachSend'

const globals = globalThis as unknown as Record<string, unknown>
const calls: Array<{ url: string, options?: Record<string, unknown> }> = []

beforeEach(() => {
  calls.length = 0
  globals.useRuntimeConfig = () => ({ public: { apiUrl: 'https://api.launchlog.test' } })
  globals.useAuth = () => ({ getIdToken: async () => 'firebase-admin-token' })
  globals.$fetch = (url: string, options?: Record<string, unknown>) => {
    calls.push({ url, options })
    return Promise.resolve({
      data: {
        request_id: '8adf6d21-2bc6-4c96-8dd6-e17f83956275',
        status: 'accepted',
      },
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
  test('posts the exact payload with the Firebase bearer token', async () => {
    const result = await useOutreachSend().send({
      recipientEmail: 'founder@example.com',
      subject: 'Hello',
      text: 'Plain text body',
      requestId: '8adf6d21-2bc6-4c96-8dd6-e17f83956275',
    })

    expect(result.status).toBe('accepted')
    expect(calls).toEqual([{
      url: 'https://api.launchlog.test/api/v1/admin/outreach/send',
      options: {
        method: 'POST',
        headers: { Authorization: 'Bearer firebase-admin-token' },
        body: {
          recipient_email: 'founder@example.com',
          subject: 'Hello',
          text: 'Plain text body',
          request_id: '8adf6d21-2bc6-4c96-8dd6-e17f83956275',
        },
      },
    }])
  })

  test('fails before the request when Firebase has no token', async () => {
    globals.useAuth = () => ({ getIdToken: async () => null })

    await expect(useOutreachSend().send({
      recipientEmail: 'founder@example.com',
      subject: 'Hello',
      text: 'Body',
      requestId: crypto.randomUUID(),
    })).rejects.toThrow('Not authenticated')

    expect(calls).toHaveLength(0)
  })
})
