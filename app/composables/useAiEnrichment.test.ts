import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { AiEnrichmentProposal } from './useAiEnrichment'
import { useAiEnrichment } from './useAiEnrichment'

const API = 'https://api.launchlog.test'
const TOKEN = 'firebase-id-token'
const globals = globalThis as unknown as Record<string, unknown>

type FetchCall = { url: string, options: Record<string, unknown> | undefined }

let calls: FetchCall[] = []
let response: unknown

const proposal = (id: string): AiEnrichmentProposal => ({
  id,
  listing_id: 'listing-1',
  status: 'pending',
  current: {},
  proposed: {},
  category: { slug: null, name: null, requires_approval: false },
  evidence: {},
  model: 'gemini-2.5-flash-lite',
  applied_fields: [],
  created_at: '2026-08-30T00:00:00Z',
})

beforeEach(() => {
  calls = []
  response = { data: {} }
  globals.useRuntimeConfig = () => ({ public: { apiUrl: API } })
  globals.useAuth = () => ({
    waitForAuthReady: async () => {},
    getIdToken: async () => TOKEN,
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

describe('AI enrichment review requests', () => {
  const quota = {
    eligible: true,
    used: 2,
    limit: 5,
    remaining: 3,
    period_start: '2026-08-26T00:00:00Z',
    period_end: '2027-08-26T00:00:00Z',
  }

  test('has no public-preview AI request surface', () => {
    expect('suggestPreview' in useAiEnrichment()).toBe(false)
  })

  test('loads the pending owner proposal together with its paid-period quota', async () => {
    const pending = proposal('proposal-1')
    response = {
      data: [pending],
      meta: { ai_quota: quota },
    }

    const result = await useAiEnrichment().listOwnerProposals('listing-1')

    expect(result).toEqual({
      proposals: [pending],
      quota,
    })
    expect(calls).toEqual([{
      url: `${API}/api/v1/dashboard/listings/listing-1/ai-proposals`,
      options: { headers: { Authorization: `Bearer ${TOKEN}` } },
    }])
  })

  test('generates an owner proposal and returns the updated paid-period quota', async () => {
    const pending = proposal('proposal-2')
    response = {
      data: pending,
      meta: { ai_quota: { ...quota, used: 3, remaining: 2 } },
    }

    const ai = useAiEnrichment()
    const result = await ai.generateOwnerProposal('listing-1')

    expect(result).toEqual({
      proposal: pending,
      quota: { ...quota, used: 3, remaining: 2 },
    })
    expect(calls).toEqual([{
      url: `${API}/api/v1/dashboard/listings/listing-1/ai-proposals`,
      options: {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
      },
    }])
  })

  test('selectively applies an owner proposal', async () => {
    await useAiEnrichment().applyOwnerProposal('proposal-1', ['name', 'description'])

    expect(calls).toEqual([{
      url: `${API}/api/v1/dashboard/ai-proposals/proposal-1/apply`,
      options: {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: { fields: ['name', 'description'] },
      },
    }])
  })

  test('loads existing admin drafts before generating another one', async () => {
    response = { data: [{ id: 'proposal-1', status: 'pending' }] }

    const proposals = await useAiEnrichment().listAdminProposals('listing-1')

    expect(proposals.map(({ id, status }) => ({ id, status }))).toEqual([{ id: 'proposal-1', status: 'pending' }])
    expect(calls).toEqual([{
      url: `${API}/api/v1/admin/listings/listing-1/ai-proposals`,
      options: { headers: { Authorization: `Bearer ${TOKEN}` } },
    }])
  })
})
