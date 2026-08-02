import type { ListingSource, ListingTier } from '~/composables/useListings'

export type ListingStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived' | 'spam'

export interface AdminListing {
  id: string
  slug: string
  name: string
  tagline: string | null
  description: string | null
  link_text: string | null
  url: string
  screenshot_url: string | null
  status: ListingStatus
  tier: ListingTier | null
  source: ListingSource
  primary_category_id: string | null
  category: { id: string, slug: string, name: string } | null
  tags: { slug: string, name: string }[]
  tech_stack: string[]
  country: string | null
  pricing: { low: number | null, high: number | null, currency: string | null }
  published_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface AdminListingFilters {
  status?: string
  tier?: string
  source?: string
  q?: string
  page?: number
}

export interface AdminListingPaginationMeta {
  current_page: number
  from: number | null
  last_page: number
  per_page: number
  to: number | null
  total: number
}

export interface AdminListingPage {
  data: AdminListing[]
  links: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
  meta: AdminListingPaginationMeta
}

export interface FounderScreenshotRun {
  status: 'started'
  limit: number
  dry_run: boolean
  pid: string
  log_file: string
}

export interface FounderScreenshotStatus {
  log_file: string | null
  modified_at: string | null
  tail: string[]
}

export interface AdminDashboard {
  totals: {
    listings: number
    published: number
    pending_review: number
    draft: number
    rejected: number
    with_screenshots: number
    missing_screenshots: number
    founding_missing_screenshots: number
  }
  status_counts: Record<string, number>
  tier_counts: Record<string, number>
  source_counts: Record<string, number>
  coverage: {
    published_percent: number
    screenshot_percent: number
  }
  recent_listings: AdminListing[]
  generated_at: string
}

/**
 * Admin moderation API client. Sends the Firebase ID token as a Bearer header;
 * the backend `admin` middleware is the real authority (D-055) — these calls 403
 * for non-admins regardless of any client gate.
 */
export const useAdminListings = () => {
  const config = useRuntimeConfig()
  const base = `${config.public.apiUrl}/api/v1/admin`
  const { getIdToken } = useAuth()

  const authHeaders = async (): Promise<Record<string, string>> => {
    const token = await getIdToken()
    if (!token) throw new Error('Not authenticated')
    return { Authorization: `Bearer ${token}` }
  }

  const list = async (filters: AdminListingFilters = {}): Promise<AdminListingPage> => {
    const query = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    return await $fetch<AdminListingPage>(`${base}/listings`, {
      headers: await authHeaders(),
      query,
    })
  }

  const dashboard = async (): Promise<AdminDashboard> => {
    const { data } = await $fetch<{ data: AdminDashboard }>(`${base}/dashboard`, {
      headers: await authHeaders(),
    })
    return data
  }

  const get = async (id: string): Promise<AdminListing> => {
    const { data } = await $fetch<{ data: AdminListing }>(`${base}/listings/${id}`, {
      headers: await authHeaders(),
    })
    return data
  }

  const create = async (payload: Partial<AdminListing>): Promise<AdminListing> => {
    const { data } = await $fetch<{ data: AdminListing }>(`${base}/listings`, {
      method: 'POST',
      headers: await authHeaders(),
      body: payload,
    })
    return data
  }

  const update = async (id: string, payload: Partial<AdminListing>): Promise<AdminListing> => {
    const { data } = await $fetch<{ data: AdminListing }>(`${base}/listings/${id}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: payload,
    })
    return data
  }

  const action = async (id: string, verb: 'publish' | 'unpublish' | 'reject'): Promise<AdminListing> => {
    const { data } = await $fetch<{ data: AdminListing }>(`${base}/listings/${id}/${verb}`, {
      method: 'POST',
      headers: await authHeaders(),
    })
    return data
  }

  const runFounderScreenshots = async (limit = 50, dryRun = false): Promise<FounderScreenshotRun> => {
    const { data } = await $fetch<{ data: FounderScreenshotRun }>(`${base}/founding-screenshots/run`, {
      method: 'POST',
      headers: await authHeaders(),
      body: { limit, dry_run: dryRun },
    })
    return data
  }

  const founderScreenshotStatus = async (): Promise<FounderScreenshotStatus> => {
    const { data } = await $fetch<{ data: FounderScreenshotStatus }>(`${base}/founding-screenshots/status`, {
      headers: await authHeaders(),
    })
    return data
  }

  return {
    dashboard,
    list,
    get,
    create,
    update,
    publish: (id: string) => action(id, 'publish'),
    unpublish: (id: string) => action(id, 'unpublish'),
    reject: (id: string) => action(id, 'reject'),
    runFounderScreenshots,
    founderScreenshotStatus,
  }
}
