import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { useOutreachHistory } from './useOutreachHistory'

const API = 'https://api.launchlog.test'
const TOKEN = 'firebase-admin-token'
const sendId = 'f642097d-9070-4e00-b2e7-00f0e0e4ea6a'
const requestId = '8adf6d21-2bc6-4c96-8dd6-e17f83956275'
const previewUrl = `https://launchlog.ai/preview/${'A'.repeat(64)}`

const sendResource = {
  id: sendId,
  request_id: requestId,
  recipient_email: 'founder@example.com',
  first_name: 'Maya',
  product_name: 'ShipFast',
  source_name: 'Product Hunt',
  subject_variant: 'preview',
  subject: 'I made a private LaunchLog preview for ShipFast',
  text: 'Hi Maya,\n\nExact body.',
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

const historyPage = {
  data: [sendResource],
  links: {
    first: `${API}/api/v1/admin/outreach/sends?page=1`,
    last: `${API}/api/v1/admin/outreach/sends?page=3`,
    prev: `${API}/api/v1/admin/outreach/sends?page=1`,
    next: `${API}/api/v1/admin/outreach/sends?page=3`,
  },
  meta: {
    current_page: 2,
    from: 21,
    last_page: 3,
    per_page: 20,
    to: 21,
    total: 41,
  },
} as const

type FetchCall = { url: string, options?: Record<string, unknown> }

const globals = globalThis as unknown as Record<string, unknown>
let calls: FetchCall[] = []
let response: unknown
let tokenCalls = 0

beforeEach(() => {
  calls = []
  tokenCalls = 0
  response = historyPage
  globals.useRuntimeConfig = () => ({ public: { apiUrl: API } })
  globals.useAuth = () => ({
    getIdToken: async () => {
      tokenCalls += 1
      return TOKEN
    },
  })
  globals.$fetch = (url: string, options?: Record<string, unknown>) => {
    calls.push({ url, options })
    return Promise.resolve(response)
  }
})

afterEach(() => {
  delete globals.useRuntimeConfig
  delete globals.useAuth
  delete globals.$fetch
})

describe('outreach history API boundary', () => {
  test('lists exactly one validated Laravel page with bearer auth and its page query', async () => {
    const page = await useOutreachHistory().list(2)

    expect(page).toEqual(historyPage)
    expect(calls).toEqual([{
      url: `${API}/api/v1/admin/outreach/sends`,
      options: {
        headers: { Authorization: `Bearer ${TOKEN}` },
        query: { page: 2 },
      },
    }])
  })

  test('refreshes exactly one validated row through the manual reconciliation route', async () => {
    response = { data: sendResource }

    const refreshed = await useOutreachHistory().refresh(sendId)

    expect(refreshed).toEqual(sendResource)
    expect(calls).toEqual([{
      url: `${API}/api/v1/admin/outreach/sends/${sendId}/refresh`,
      options: {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
      },
    }])
  })

  test('rejects an invalid page or UUID before requesting auth or the network', async () => {
    const history = useOutreachHistory()

    await expect(history.list(0)).rejects.toThrow('Invalid outreach history page')
    await expect(history.refresh('not-a-uuid')).rejects.toThrow('Invalid outreach send ID')

    expect(tokenCalls).toBe(0)
    expect(calls).toHaveLength(0)
  })

  test('fails before the network when Firebase has no token', async () => {
    globals.useAuth = () => ({ getIdToken: async () => null })

    await expect(useOutreachHistory().list(2)).rejects.toThrow('Not authenticated')

    expect(calls).toHaveLength(0)
  })

  test('rejects page metadata that does not describe the requested resource slice', async () => {
    const invalidPages = [
      { ...historyPage, meta: { ...historyPage.meta, current_page: 1 } },
      { ...historyPage, meta: { ...historyPage.meta, last_page: 0 } },
      { ...historyPage, meta: { ...historyPage.meta, from: 40, to: 21 } },
      { ...historyPage, meta: { ...historyPage.meta, to: 22 } },
      { ...historyPage, data: [], meta: { ...historyPage.meta, from: 21, to: 21 } },
    ]

    for (const invalidPage of invalidPages) {
      response = invalidPage
      await expect(useOutreachHistory().list(2))
        .rejects.toThrow('Invalid outreach history response')
    }
  })

  test('rejects malformed links, statuses, timestamps, and response UUIDs', async () => {
    const invalidPages = [
      { ...historyPage, links: { ...historyPage.links, next: 'not-a-url' } },
      { ...historyPage, data: [{ ...sendResource, status: 'queued' }] },
      { ...historyPage, data: [{ ...sendResource, created_at: 'yesterday' }] },
      { ...historyPage, data: [{ ...sendResource, id: 'not-a-uuid' }] },
    ]

    for (const invalidPage of invalidPages) {
      response = invalidPage
      await expect(useOutreachHistory().list(2))
        .rejects.toThrow('Invalid outreach history response')
    }
  })

  test('rejects a manual refresh resource that does not match the requested UUID', async () => {
    response = {
      data: {
        ...sendResource,
        id: 'c47e38cb-d26d-47d4-8643-50ef871f059f',
      },
    }

    await expect(useOutreachHistory().refresh(sendId))
      .rejects.toThrow('Invalid outreach history response')
  })
})
