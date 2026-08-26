import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { CustomerListing } from './useCustomerListings'
import { useCustomerDashboardState, useCustomerListings } from './useCustomerListings'

const API = 'https://api.launchlog.test'
const TOKEN = 'firebase-id-token'

type FetchCall = { url: string, options: Record<string, unknown> | undefined }

const globals = globalThis as unknown as Record<string, unknown>
let calls: FetchCall[] = []
let tokenCalls = 0
let response: unknown

const LISTING = {
  id: 'listing-1',
  slug: 'acme',
  name: 'Acme',
  tagline: null,
  description: null,
  url: 'https://acme.test',
  screenshot_url: null,
  status: 'published',
  tier: null,
  published_at: '2026-08-01T12:00:00.000000Z',
  expires_at: null,
  subscription: null,
  receipt: {
    public_url: 'https://launchlog.ai/listing/acme',
    schema_url: 'https://launchlog.ai/listing/acme/schema',
    markdown_url: 'https://launchlog.ai/listing/acme/markdown',
    sitemap_url: 'https://launchlog.ai/sitemap.xml',
    llms_url: 'https://launchlog.ai/llms-full.txt',
    checks: { published: true, schema: true, markdown: true, llms: true },
  },
} satisfies CustomerListing

beforeEach(() => {
  calls = []
  tokenCalls = 0
  response = { data: [] }
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

describe('customer listing requests', () => {
  test('lists owned listings with a fresh Firebase bearer token', async () => {
    response = { data: [LISTING] }

    const result = await useCustomerListings().list()

    expect(result).toEqual([LISTING])
    expect(tokenCalls).toBe(1)
    expect(calls).toEqual([{
      url: `${API}/api/v1/dashboard/listings`,
      options: { headers: { Authorization: `Bearer ${TOKEN}` } },
    }])
  })

  test('updates only the editable listing fields', async () => {
    response = { data: { id: 'listing-1', name: 'New name' } }

    await useCustomerListings().update('listing-1', {
      name: 'New name',
      tagline: 'A useful line',
      description: null,
    })

    expect(tokenCalls).toBe(1)
    expect(calls[0]).toEqual({
      url: `${API}/api/v1/dashboard/listings/listing-1`,
      options: {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: {
          name: 'New name',
          tagline: 'A useful line',
          description: null,
        },
      },
    })
  })

  test('opens billing only for an HTTPS Stripe Billing URL', async () => {
    response = { data: { url: 'https://billing.stripe.com/p/session/test_1' } }

    const url = await useCustomerListings().billingPortal('listing-1')

    expect(url).toBe('https://billing.stripe.com/p/session/test_1')
    expect(calls[0]).toEqual({
      url: `${API}/api/v1/dashboard/listings/listing-1/billing-portal`,
      options: {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: {},
      },
    })
  })

  test('rejects a non-Stripe billing redirect', async () => {
    response = { data: { url: 'https://evil.test/steal-session' } }

    await expect(useCustomerListings().billingPortal('listing-1'))
      .rejects.toThrow('Invalid billing portal URL')
  })

  test('fails before the request when Firebase has no current token', async () => {
    globals.useAuth = () => ({ getIdToken: async () => null })

    await expect(useCustomerListings().list()).rejects.toThrow('Not authenticated')
    expect(calls).toHaveLength(0)
  })
})

describe('customer dashboard private state', () => {
  test('keeps concurrent listing actions independent', () => {
    const state = useCustomerDashboardState()

    state.beginSaving('listing-1')
    state.beginSaving('listing-2')
    state.finishSaving('listing-1')
    state.beginBilling('listing-1')
    state.beginBilling('listing-2')
    state.finishBilling('listing-2')

    expect(state.savingIds.has('listing-1')).toBeFalse()
    expect(state.savingIds.has('listing-2')).toBeTrue()
    expect(state.billingIds.has('listing-1')).toBeTrue()
    expect(state.billingIds.has('listing-2')).toBeFalse()
  })

  test('clears all private listing data before logout navigation', () => {
    const state = useCustomerDashboardState()
    state.syncListings([LISTING])
    state.actionErrors['listing-1'] = 'Private provider error'
    state.beginSaving('listing-1')
    state.beginBilling('listing-1')
    state.markSaved('listing-1')

    state.clearPrivateData()

    expect(state.listings.value).toEqual([])
    expect(state.drafts).toEqual({})
    expect(state.actionErrors).toEqual({})
    expect(state.savingIds.size).toBe(0)
    expect(state.billingIds.size).toBe(0)
    expect(state.savedIds.size).toBe(0)
  })
})
