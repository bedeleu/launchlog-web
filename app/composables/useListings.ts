export type ListingTier = 'basic' | 'premium' | 'featured'

/** Origin of a listing (D-060) — independent of billing tier. */
export type ListingSource = 'seed' | 'founding' | 'customer' | 'admin'

export interface ListingCategory {
  slug: string
  name: string
}

export interface ListingTag {
  slug: string
  name: string
}

export interface ListingPricing {
  low: number
  high: number
  currency: string
}

/**
 * Card shape returned by the list endpoint — the detail fields minus
 * description / link_text / enriched_at.
 */
export interface ListingCard {
  slug: string
  name: string
  tagline: string
  url: string
  screenshot_url: string | null
  tier: ListingTier
  source: ListingSource
  category: ListingCategory | null
  tags: ListingTag[]
  tech_stack: string[]
  has_llms_txt: boolean
  has_schema_org: boolean
  has_markdown_negotiation: boolean
  country: string | null
  pricing?: ListingPricing
  published_at: string | null
}

export interface Listing extends ListingCard {
  description: string | null
  link_text: string | null
  enriched_at: string | null
}

export interface ListingPaginationMeta {
  current_page: number
  from: number | null
  last_page: number
  /** Records actually returned on this page — variable under view=directory. */
  per_page: number
  to: number | null
  total: number
  /**
   * Slot-aware directory pages only (view=directory). Ordinary paginated calls
   * — /featured, dashboard, admin, recent — never send them, so both stay
   * optional rather than forcing every caller to invent a value.
   */
  slot_capacity?: number
  slots_used?: number
}

export interface ListingPage {
  data: ListingCard[]
  meta: ListingPaginationMeta
}

/**
 * Public listings API. Published listings only — getListing throws (404) for
 * anything not live. Responses are Laravel JsonResource envelopes ({ data }).
 */
export const useListings = () => {
  const config = useRuntimeConfig()
  // apiUrl is host-only; routes/api.php is mounted under /api (D-051).
  const base = `${config.public.apiUrl}/api/v1`

  const getListing = async (slug: string): Promise<Listing> => {
    const { data } = await $fetch<{ data: Listing }>(`${base}/listings/${slug}`)
    return data
  }

  const listListings = async (
    params?: Record<string, string | number>,
  ): Promise<ListingCard[]> => {
    const { data } = await $fetch<{ data: ListingCard[] }>(`${base}/listings`, {
      query: params,
    })
    return data
  }

  const listListingPage = async (
    params?: Record<string, string | number>,
  ): Promise<ListingPage> => {
    return await $fetch<ListingPage>(`${base}/listings`, {
      query: params,
    })
  }

  return { getListing, listListings, listListingPage }
}
