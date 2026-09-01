export type AdminEditionStatus = 'draft' | 'published'

export interface AdminEditionItemInput {
  kind: 'new_listing'
  listing_id: string
  position: number
  shipped_at?: string | null
  provenance_url?: string | null
}

export interface AdminEditionItem extends Required<AdminEditionItemInput> {
  id: string
  source_week_starts_at: string | null
  carried_over: boolean
  visible: boolean
  snapshot_name: string
}

export interface AdminEditionCandidate {
  listing_id: string
  name: string
  source: 'customer' | 'admin' | 'founding'
  tier: 'basic' | 'featured'
  published_at: string | null
  public: boolean
}

export interface AdminEdition {
  id: string
  slug: string
  week_starts_at: string
  cutoff_at: string
  introduction: string | null
  status: AdminEditionStatus
  published_at: string | null
  modified_at: string
  items: AdminEditionItem[]
  candidates?: AdminEditionCandidate[]
}

export interface AdminEditionPage {
  data: AdminEdition[]
  links: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
  meta: {
    current_page: number
    from: number | null
    last_page: number
    per_page: number
    to: number | null
    total: number
    links: Array<{ url: string | null, label: string, active: boolean }>
    path: string
  }
}

type Fetcher = <T>(url: string, options?: Record<string, unknown>) => Promise<T>
type Token = () => Promise<string | null>

export function createAdminEditionClient(fetcher: Fetcher, apiUrl: string, token: Token) {
  const request = async <T>(path: string, options: Record<string, unknown> = {}): Promise<T> => {
    const bearer = await token()
    if (!bearer) throw new Error('Not authenticated')

    return await fetcher<T>(`${apiUrl}/api/v1/admin/weekly-editions${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${bearer}` },
    })
  }

  const resource = async (path: string, options: Record<string, unknown> = {}): Promise<AdminEdition> => {
    const { data } = await request<{ data: AdminEdition }>(path, options)
    return data
  }

  return {
    list: (page = 1): Promise<AdminEditionPage> => request<AdminEditionPage>(`?page=${page}`),
    get: (id: string): Promise<AdminEdition> => resource(`/${encodeURIComponent(id)}`),
    create: (body: { slug: string, introduction: string | null }): Promise<AdminEdition> => (
      resource('', { method: 'POST', body })
    ),
    updateIntroduction: (id: string, introduction: string | null): Promise<AdminEdition> => (
      resource(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: { introduction } })
    ),
    replaceItems: (id: string, items: AdminEditionItemInput[]): Promise<AdminEdition> => (
      resource(`/${encodeURIComponent(id)}/items`, { method: 'PUT', body: { items } })
    ),
    publish: (id: string): Promise<AdminEdition> => (
      resource(`/${encodeURIComponent(id)}/publish`, { method: 'POST' })
    ),
    setVisibility: (id: string, itemId: string, visible: boolean): Promise<AdminEdition> => (
      resource(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: { item_id: itemId, visible } })
    ),
  }
}

export function useAdminEditions() {
  const config = useRuntimeConfig()
  const { getIdToken } = useAuth()
  return createAdminEditionClient($fetch, config.public.apiUrl as string, getIdToken)
}
