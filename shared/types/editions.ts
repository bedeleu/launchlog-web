export interface EditionSummary {
  slug: string
  week_starts_at: string
  week_ends_at: string
  introduction: string | null
  published_at: string
  modified_at: string
  item_count: number
  path: string
}

export interface EditionItem {
  kind: 'new_listing'
  position: number
  shipped_at: string
  source_week_starts_at: string | null
  carried_over: boolean
  name: string
  tagline: string | null
  tier_label: 'Standard' | 'Featured'
  image_url: string | null
  current: boolean
  listing_path: string | null
  provenance_url: string | null
  include_in_item_list: boolean
}

export interface EditionDetail extends Omit<EditionSummary, 'item_count'> {
  items: EditionItem[]
}

export interface EditionPage {
  data: EditionSummary[]
  meta: {
    current_page: number
    last_page: number
    per_page: 24
    total: number
  }
}
