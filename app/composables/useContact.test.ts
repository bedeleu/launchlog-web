import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { useContact, type ContactRequestPayload } from './useContact'

const API = 'https://api.launchlog.test'
const globals = globalThis as unknown as Record<string, unknown>

type FetchCall = { url: string, options?: Record<string, unknown> }
let calls: FetchCall[]
let authEvents: string[]

beforeEach(() => {
  calls = []
  authEvents = []
  globals.useRuntimeConfig = () => ({ public: { apiUrl: API } })
  globals.useAuth = () => ({
    waitForAuthReady: async () => {
      authEvents.push('ready')
    },
    getIdToken: async () => {
      authEvents.push('token')
      return 'firebase-id-token'
    },
  })
  globals.$fetch = (url: string, options?: Record<string, unknown>) => {
    calls.push({ url, options })
    return Promise.resolve({ data: { accepted: true } })
  }
})

afterEach(() => {
  delete globals.useRuntimeConfig
  delete globals.useAuth
  delete globals.$fetch
})

describe('contact request', () => {
  test('posts the exact request with verified identity when available', async () => {
    const payload = {
      topic: 'listing_claim' as const,
      name: 'Alex Maker',
      email: 'typed@example.com',
      website: 'https://maker.example',
      message: 'Please help me verify ownership.',
    }

    await useContact().sendContactRequest(payload)

    expect(calls).toEqual([{
      url: `${API}/api/v1/contact`,
      options: {
        method: 'POST',
        body: payload,
        headers: { Authorization: 'Bearer firebase-id-token' },
      },
    }])
    expect(authEvents).toEqual(['ready', 'token'])
  })

  test('works for guests without sending an empty Authorization header', async () => {
    globals.useAuth = () => ({
      waitForAuthReady: async () => {
        authEvents.push('ready')
      },
      getIdToken: async () => {
        authEvents.push('token')
        return null
      },
    })

    await useContact().sendContactRequest({
      topic: 'support',
      name: 'Guest',
      email: 'guest@example.com',
      website: '',
      message: 'I need help.',
    })

    expect(calls[0]?.options?.headers).toBeUndefined()
    expect(authEvents).toEqual(['ready', 'token'])
  })

  test('sends only fields the person can see when browser autofill adds metadata', async () => {
    const browserPayload = {
      topic: 'listing_claim' as const,
      name: 'Alex Maker',
      email: 'alex@example.com',
      website: 'https://maker.example',
      message: 'Please help me verify ownership.',
      company: 'Browser autofilled company',
    }

    await useContact().sendContactRequest(browserPayload)

    expect(calls[0]?.options?.body).toEqual({
      topic: 'listing_claim',
      name: 'Alex Maker',
      email: 'alex@example.com',
      website: 'https://maker.example',
      message: 'Please help me verify ownership.',
    })
  })

  test('clears guest fields after a successful request', () => {
    const form: ContactRequestPayload = {
      topic: 'listing_claim',
      name: 'Alex Maker',
      email: 'alex@example.com',
      website: 'https://maker.example',
      message: 'Please help me verify ownership.',
    }

    useContact().resetContactForm(form, null)

    expect(form).toEqual({
      topic: 'support',
      name: '',
      email: '',
      website: '',
      message: '',
    })
  })

  test('keeps the verified account email when resetting the form', () => {
    const form: ContactRequestPayload = {
      topic: 'billing',
      name: 'Alex Maker',
      email: 'stale@example.com',
      website: 'https://maker.example',
      message: 'Please help me with billing.',
    }

    useContact().resetContactForm(form, 'verified@example.com')

    expect(form).toEqual({
      topic: 'support',
      name: '',
      email: 'verified@example.com',
      website: '',
      message: '',
    })
  })
})
