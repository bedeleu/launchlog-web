import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { useAiEnrichment } from './useAiEnrichment'

const API = 'https://api.launchlog.test'
const TOKEN = 'firebase-id-token'
const globals = globalThis as unknown as Record<string, unknown>

type FetchCall = { url: string, options: Record<string, unknown> | undefined }

let calls: FetchCall[] = []
let response: unknown

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
  test('requests a preview draft without applying it', async () => {
    await useAiEnrichment().suggestPreview('preview-token')

    expect(calls).toEqual([{
      url: `${API}/api/v1/previews/preview-token/ai-suggestion`,
      options: {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
      },
    }])
  })

  test('generates and selectively applies an owner proposal', async () => {
    const ai = useAiEnrichment()
    await ai.generateOwnerProposal('listing-1')
    await ai.applyOwnerProposal('proposal-1', ['name', 'description'])

    expect(calls).toEqual([
      {
        url: `${API}/api/v1/dashboard/listings/listing-1/ai-proposals`,
        options: { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` } },
      },
      {
        url: `${API}/api/v1/dashboard/ai-proposals/proposal-1/apply`,
        options: {
          method: 'POST',
          headers: { Authorization: `Bearer ${TOKEN}` },
          body: { fields: ['name', 'description'] },
        },
      },
    ])
  })

  test('keeps batch cleanup dry-run until selected proposals are explicitly applied', async () => {
    const ai = useAiEnrichment()
    await ai.createBatch({ limit: 25, filters: { status: 'published' } })
    await ai.applyBatch('batch-1', ['proposal-1'], ['tagline'])

    expect(calls).toEqual([
      {
        url: `${API}/api/v1/admin/ai-enrichment/batches`,
        options: {
          method: 'POST',
          headers: { Authorization: `Bearer ${TOKEN}` },
          body: { limit: 25, filters: { status: 'published' } },
        },
      },
      {
        url: `${API}/api/v1/admin/ai-enrichment/batches/batch-1/apply`,
        options: {
          method: 'POST',
          headers: { Authorization: `Bearer ${TOKEN}` },
          body: { proposal_ids: ['proposal-1'], fields: ['tagline'] },
        },
      },
    ])
  })
})
