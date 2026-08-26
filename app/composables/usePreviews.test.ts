import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existingListingConflictFromError, usePreviews } from './usePreviews'

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
    return Promise.resolve({ data: { token: 'p'.repeat(64) } })
  }
})

afterEach(() => {
  delete globals.useRuntimeConfig
  delete globals.useAuth
  delete globals.$fetch
})

describe('preview identity and existing-listing routing', () => {
  test('sends the verified identity on create and lookup', async () => {
    const previews = usePreviews()

    await previews.createPreview('https://maker.example')
    await previews.getPreview('p'.repeat(64))

    expect(calls).toHaveLength(2)
    expect(calls[0]).toEqual({
      url: `${API}/api/v1/previews`,
      options: {
        method: 'POST',
        body: { url: 'https://maker.example' },
        headers: { Authorization: 'Bearer firebase-id-token' },
      },
    })
    expect(calls[1]).toEqual({
      url: `${API}/api/v1/previews/${'p'.repeat(64)}`,
      options: { headers: { Authorization: 'Bearer firebase-id-token' } },
    })
    expect(authEvents).toEqual(['ready', 'token', 'ready', 'token'])
  })

  test('omits Authorization for guests', async () => {
    globals.useAuth = () => ({
      waitForAuthReady: async () => {
        authEvents.push('ready')
      },
      getIdToken: async () => {
        authEvents.push('token')
        return null
      },
    })

    await usePreviews().createPreview('https://maker.example')

    expect(calls[0]?.options?.headers).toBeUndefined()
    expect(authEvents).toEqual(['ready', 'token'])
  })

  test('cancels the exact preview checkout with the current verified identity', async () => {
    const token = 'p'.repeat(64)

    await usePreviews().cancelPreviewCheckout(token)

    expect(calls).toEqual([{
      url: `${API}/api/v1/previews/${token}/checkout/cancel`,
      options: {
        method: 'POST',
        headers: { Authorization: 'Bearer firebase-id-token' },
      },
    }])
    expect(authEvents).toEqual(['ready', 'token'])
  })

  test('accepts only the safe conflict contract from a 409 response', () => {
    const conflict = existingListingConflictFromError({
      data: {
        error: 'listing_exists',
        conflict: {
          action: 'manage',
          domain: 'maker.example',
          listing_path: '/listing/maker-example',
          dashboard_path: '/dashboard',
          owner_email: 'must-not-leak@example.com',
        },
      },
    })

    expect(conflict).toEqual({
      action: 'manage',
      domain: 'maker.example',
      listing_path: '/listing/maker-example',
      dashboard_path: '/dashboard',
    })
  })

  test('rejects malformed or unrelated API failures as conflicts', () => {
    expect(existingListingConflictFromError({ data: { error: 'validation_error' } })).toBeNull()
    expect(existingListingConflictFromError({
      data: { error: 'listing_exists', conflict: { action: 'claim', domain: '' } },
    })).toBeNull()
  })
})
