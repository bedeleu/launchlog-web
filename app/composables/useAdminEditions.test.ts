import { describe, expect, test } from 'bun:test'

const API = 'https://api.example'
const TOKEN = 'firebase-token'
const EDITION_ID = 'edition/id?draft space'

type Fetcher = (url: string, options?: Record<string, unknown>) => Promise<unknown>
type Token = () => Promise<string | null>
type FetchCall = { url: string, options: Record<string, unknown> | undefined }
type EditionResource = Record<string, unknown>
type EditionPage = {
  data: EditionResource[]
  links: Record<string, string | null>
  meta: Record<string, unknown>
}
type AdminEditionItemInput = {
  kind: 'new_listing'
  listing_id: string
  position: number
  shipped_at?: string | null
  provenance_url?: string | null
}
type AdminEditionClient = {
  list: (page?: number) => Promise<EditionPage>
  get: (id: string) => Promise<EditionResource>
  create: (body: { slug: string, introduction: string | null }) => Promise<EditionResource>
  updateIntroduction: (id: string, introduction: string | null) => Promise<EditionResource>
  replaceItems: (id: string, items: AdminEditionItemInput[]) => Promise<EditionResource>
  publish: (id: string) => Promise<EditionResource>
  setVisibility: (id: string, itemId: string, visible: boolean) => Promise<EditionResource>
}
type CreateAdminEditionClient = (fetcher: Fetcher, apiUrl: string, token: Token) => AdminEditionClient

const loadCreateAdminEditionClient = async (): Promise<CreateAdminEditionClient> => {
  const modulePath = './useAdminEditions'
  const module = await import(modulePath) as { createAdminEditionClient: CreateAdminEditionClient }
  return module.createAdminEditionClient
}

const item = {
  id: 'item-id',
  kind: 'new_listing',
  listing_id: 'listing-id',
  position: 1,
  shipped_at: '2026-08-27',
  source_week_starts_at: null,
  carried_over: false,
  provenance_url: 'https://example.test/release',
  visible: true,
  snapshot_name: 'LaunchLog',
}

const editionFields: EditionResource = {
  id: EDITION_ID,
  slug: '2026-w35',
  week_starts_at: '2026-08-24',
  cutoff_at: '2026-08-31T00:00:00+00:00',
  introduction: 'Week',
  status: 'draft',
  published_at: null,
  modified_at: '2026-08-31T00:05:00+00:00',
  items: [item],
}

const edition = (overrides: Record<string, unknown> = {}): EditionResource => ({
  ...editionFields,
  candidates: [{
    listing_id: 'listing-id',
    name: 'LaunchLog',
    source: 'admin',
    tier: 'featured',
    published_at: '2026-08-27T12:00:00+00:00',
    public: true,
  }],
  ...overrides,
})

const listEdition = (): EditionResource => ({ ...editionFields })

const page: EditionPage = {
  data: [listEdition()],
  links: {
    first: `${API}/api/v1/admin/weekly-editions?page=1`,
    last: `${API}/api/v1/admin/weekly-editions?page=3`,
    prev: `${API}/api/v1/admin/weekly-editions?page=1`,
    next: `${API}/api/v1/admin/weekly-editions?page=3`,
  },
  meta: {
    current_page: 2,
    from: 25,
    last_page: 3,
    links: [
      { url: `${API}/api/v1/admin/weekly-editions?page=1`, label: '&laquo; Previous', active: false },
      { url: `${API}/api/v1/admin/weekly-editions?page=2`, label: '2', active: true },
      { url: `${API}/api/v1/admin/weekly-editions?page=3`, label: '3', active: false },
      { url: `${API}/api/v1/admin/weekly-editions?page=3`, label: 'Next &raquo;', active: false },
    ],
    path: `${API}/api/v1/admin/weekly-editions`,
    per_page: 24,
    to: 48,
    total: 64,
  },
}

const inputItem: AdminEditionItemInput = {
  kind: 'new_listing',
  listing_id: 'listing-id',
  position: 1,
  shipped_at: '2026-08-27',
  provenance_url: 'https://example.test/release',
}

const requestActions: Array<[string, (client: AdminEditionClient) => Promise<unknown>]> = [
  ['list', client => client.list(2)],
  ['get', client => client.get(EDITION_ID)],
  ['create', client => client.create({ slug: '2026-w35', introduction: null })],
  ['updateIntroduction', client => client.updateIntroduction(EDITION_ID, null)],
  ['replaceItems', client => client.replaceItems(EDITION_ID, [inputItem])],
  ['publish', client => client.publish(EDITION_ID)],
  ['setVisibility', client => client.setVisibility(EDITION_ID, 'item-id', false)],
]

describe('admin weekly edition client', () => {
  test('uses only the six edition routes with exact bearer tokens, encoded IDs, and payloads', async () => {
    const createAdminEditionClient = await loadCreateAdminEditionClient()
    const calls: FetchCall[] = []
    const responses = [
      page,
      { data: edition({ introduction: 'Detail' }) },
      { data: edition({ id: 'created-id', introduction: null }) },
      { data: edition({ introduction: null }) },
      { data: edition({ items: [{ ...item, position: 1 }] }) },
      { data: edition({ status: 'published', published_at: '2026-08-31T12:00:00+00:00' }) },
      { data: edition({ status: 'published', items: [{ ...item, visible: false }] }) },
    ]
    const fetcher: Fetcher = async (url, options) => {
      calls.push({ url, options })
      const response = responses.shift()
      if (!response) throw new Error('Unexpected edition request')
      return response
    }
    const client = createAdminEditionClient(fetcher, API, async () => TOKEN)

    const listed = await client.list(2)
    const detail = await client.get(EDITION_ID)
    const created = await client.create({ slug: '2026-w35', introduction: null })
    const updated = await client.updateIntroduction(EDITION_ID, null)
    const replaced = await client.replaceItems(EDITION_ID, [inputItem])
    const published = await client.publish(EDITION_ID)
    const visibility = await client.setVisibility(EDITION_ID, 'item-id', false)

    expect(listed).toEqual(page)
    expect(Object.hasOwn(listed.data[0]!, 'candidates')).toBe(false)
    expect(detail).toEqual(edition({ introduction: 'Detail' }))
    expect(created).toEqual(edition({ id: 'created-id', introduction: null }))
    expect(updated).toEqual(edition({ introduction: null }))
    expect(replaced).toEqual(edition({ items: [{ ...item, position: 1 }] }))
    expect(published).toEqual(edition({ status: 'published', published_at: '2026-08-31T12:00:00+00:00' }))
    expect(visibility).toEqual(edition({ status: 'published', items: [{ ...item, visible: false }] }))

    expect(calls).toEqual([
      {
        url: `${API}/api/v1/admin/weekly-editions?page=2`,
        options: { headers: { Authorization: `Bearer ${TOKEN}` } },
      },
      {
        url: `${API}/api/v1/admin/weekly-editions/${encodeURIComponent(EDITION_ID)}`,
        options: { headers: { Authorization: `Bearer ${TOKEN}` } },
      },
      {
        url: `${API}/api/v1/admin/weekly-editions`,
        options: {
          method: 'POST',
          headers: { Authorization: `Bearer ${TOKEN}` },
          body: { slug: '2026-w35', introduction: null },
        },
      },
      {
        url: `${API}/api/v1/admin/weekly-editions/${encodeURIComponent(EDITION_ID)}`,
        options: {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${TOKEN}` },
          body: { introduction: null },
        },
      },
      {
        url: `${API}/api/v1/admin/weekly-editions/${encodeURIComponent(EDITION_ID)}/items`,
        options: {
          method: 'PUT',
          headers: { Authorization: `Bearer ${TOKEN}` },
          body: { items: [inputItem] },
        },
      },
      {
        url: `${API}/api/v1/admin/weekly-editions/${encodeURIComponent(EDITION_ID)}/publish`,
        options: {
          method: 'POST',
          headers: { Authorization: `Bearer ${TOKEN}` },
        },
      },
      {
        url: `${API}/api/v1/admin/weekly-editions/${encodeURIComponent(EDITION_ID)}`,
        options: {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${TOKEN}` },
          body: { item_id: 'item-id', visible: false },
        },
      },
    ])
    expect(JSON.stringify(calls)).not.toContain('cutoff_at')
  })

  test.each(requestActions)('fails before fetching without a Firebase token for %s', async (_method, action) => {
    const createAdminEditionClient = await loadCreateAdminEditionClient()
    const calls: FetchCall[] = []
    const client = createAdminEditionClient(async (url, options) => {
      calls.push({ url, options })
      return { data: edition() }
    }, API, async () => null)

    await expect(action(client)).rejects.toThrow('Not authenticated')
    expect(calls).toHaveLength(0)
  })
})
