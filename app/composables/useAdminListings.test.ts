import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { AdminListingPage } from './useAdminListings'
import { useAdminListings } from './useAdminListings'

const API = 'https://api.launchlog.test'
const TOKEN = 'firebase-id-token'

type FetchCall = { url: string, options: Record<string, unknown> | undefined }

const globals = globalThis as unknown as Record<string, unknown>
let calls: FetchCall[] = []
let response: unknown

beforeEach(() => {
  calls = []
  response = {}
  globals.useRuntimeConfig = () => ({ public: { apiUrl: API } })
  globals.useAuth = () => ({ getIdToken: async () => TOKEN })
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

describe('admin listing requests', () => {
  test('retains pagination metadata and sends URL-backed filters', async () => {
    const page: AdminListingPage = {
      data: [],
      links: { first: 'first', last: 'last', prev: null, next: 'next' },
      meta: { current_page: 2, from: 31, last_page: 4, per_page: 30, to: 60, total: 104 },
    }
    response = page

    const result = await useAdminListings().list({
      status: 'pending_review',
      source: 'customer',
      tier: '',
      q: '',
      page: 2,
    })

    expect(result).toEqual(page)
    expect(calls).toEqual([{
      url: `${API}/api/v1/admin/listings`,
      options: {
        headers: { Authorization: `Bearer ${TOKEN}` },
        query: { status: 'pending_review', source: 'customer', page: 2 },
      },
    }])
  })

  test('uses only the existing publish, unpublish and reject mutation routes', async () => {
    response = { data: { id: 'listing-1' } }
    const admin = useAdminListings()

    await admin.publish('listing-1')
    await admin.unpublish('listing-1')
    await admin.reject('listing-1')

    expect(calls.map(call => [call.url, call.options?.method])).toEqual([
      [`${API}/api/v1/admin/listings/listing-1/publish`, 'POST'],
      [`${API}/api/v1/admin/listings/listing-1/unpublish`, 'POST'],
      [`${API}/api/v1/admin/listings/listing-1/reject`, 'POST'],
    ])
  })

  test('publishes a preview through the admin-only no-checkout route', async () => {
    response = { data: { id: 'listing-from-preview', tier: 'featured' } }

    const result = await useAdminListings().publishPreview('preview-token', 'featured')

    expect(result.id).toBe('listing-from-preview')
    expect(result.tier).toBe('featured')
    expect(calls).toEqual([{
      url: `${API}/api/v1/admin/previews/preview-token/publish`,
      options: {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: { tier: 'featured' },
      },
    }])
  })

  test('fails before requesting when no Firebase token is available', async () => {
    globals.useAuth = () => ({ getIdToken: async () => null })

    await expect(useAdminListings().list()).rejects.toThrow('Not authenticated')
    expect(calls).toHaveLength(0)
  })
})
