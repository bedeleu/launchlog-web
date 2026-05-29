export type ListingTier = 'free' | 'basic' | 'premium' | 'featured'

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

  return { getListing, listListings }
}
