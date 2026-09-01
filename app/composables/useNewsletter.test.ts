import { describe, expect, test } from 'bun:test'
import { createNewsletterClient, normalizeNewsletterEmail } from './useNewsletter'

const API = 'https://api.launchlog.test'

type FetchCall = { url: string, options?: Record<string, unknown> }

describe('newsletter API client', () => {
  test('normalizes accepted addresses and rejects malformed or oversized input', () => {
    expect(normalizeNewsletterEmail(' Founder@Example.COM ')).toBe('founder@example.com')
    expect(normalizeNewsletterEmail('founder@example')).toBeNull()
    expect(normalizeNewsletterEmail(`${'a'.repeat(244)}@example.com`)).toBeNull()
  })

  test('uses only LaunchLog API with the exact public contract', async () => {
    const calls: FetchCall[] = []
    const client = createNewsletterClient(async (url, options) => {
      calls.push({ url: String(url), options })
      return String(url).endsWith('/capability')
        ? { enabled: true }
        : { accepted: true }
    }, `${API}/`)

    expect(await client.capability()).toBeTrue()
    expect(await client.subscribe('founder@example.com', 'homepage')).toBeUndefined()

    expect(calls).toEqual([
      {
        url: `${API}/api/v1/newsletter/capability`,
        options: { timeout: 5000 },
      },
      {
        url: `${API}/api/v1/newsletter/subscriptions`,
        options: {
          method: 'POST',
          body: { email: 'founder@example.com', source: 'homepage' },
          timeout: 8000,
        },
      },
    ])
    expect(JSON.stringify(calls)).not.toMatch(
      /beehiiv|localStorage|sessionStorage|indexedDB|publication_id|api_key/i,
    )
  })

  test('fails capability closed for malformed or unavailable responses', async () => {
    const malformed = createNewsletterClient(async () => ({ enabled: 'true' }), API)
    const unavailable = createNewsletterClient(async () => {
      throw new Error('provider unavailable')
    }, API)

    expect(await malformed.capability()).toBeFalse()
    expect(await unavailable.capability()).toBeFalse()
  })

  test('returns the same generic result for first and repeated accepted subscriptions', async () => {
    const calls: FetchCall[] = []
    const client = createNewsletterClient(async (url, options) => {
      calls.push({ url: String(url), options })
      return { accepted: true }
    }, API)

    const first = await client.subscribe('founder@example.com', 'shipped_archive')
    const repeated = await client.subscribe('founder@example.com', 'shipped_archive')

    expect(first).toBeUndefined()
    expect(repeated).toBeUndefined()
    expect(calls).toHaveLength(2)
    expect(calls[0]).toEqual(calls[1])
  })
})
