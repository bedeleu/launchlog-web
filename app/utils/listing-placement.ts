import type { ListingTier } from '../composables/useListings'

/**
 * Card density. The tier is disclosed in the card's bottom ledger register and
 * steps the neutral surface/hairline values. Both Featured variants share one
 * monochrome placement system.
 *
 * `spotlight` is the full-width homepage Featured card;
 * `directory-spotlight` is the same visual system on the compact two-column
 * directory footprint; `directory-companion` is the real Standard record that
 * closes that Featured row. The companion only compacts once the three-column
 * directory exists, so narrower layouts keep the ordinary Standard card.
 */
export type ListingCardVariant = 'standard' | 'spotlight' | 'directory-spotlight' | 'directory-companion'

/**
 * Semantic grid footprint. The grid component maps these onto Tailwind spans;
 * the packer stays framework-free so it can be unit-tested with bun test.
 *
 * unit       1x1
 * double     2 cols x 1 row
 * full-short 3 cols x 1 row
 */
export type PlacementSpan = 'unit' | 'double' | 'full-short'

export interface PlacementListing {
  slug: string
  tier: ListingTier
}

export interface PlacedListing<T> {
  listing: T
  variant: ListingCardVariant
  span: PlacementSpan
}

/** The two presentation segments of one API directory page (same dataset). */
export interface DirectoryPageSegments<T> {
  /** Leading Featured rows: each 2x1 Featured card followed by its real Standard companion. */
  featured: PlacedListing<T>[]
  /** The remaining Standard grid. */
  standard: PlacedListing<T>[]
}

export interface HomepageListings<T> {
  hero: T | null
  featured: T[]
  recent: T[]
}

const place = <T>(listing: T, variant: ListingCardVariant, span: PlacementSpan): PlacedListing<T> =>
  ({ listing, variant, span })

/**
 * Footprints for a mixed sort=priority directory page, split into the Featured
 * section and the Standard grid — a presentation boundary over the one page
 * the API returned, never a second dataset.
 *
 * The API owns page membership: it plans thirty visual slots (at most three
 * Featured rows of 2+1, then Standards) and returns exactly the real records
 * that fill them, already ordered tier-major and daily-rotated inside each
 * tier. This function therefore only assigns footprints — it must never
 * re-sort, re-rotate, count slots, paginate or invent a card.
 *
 * Emission order matters: CSS grid auto-placement drops a Featured card's
 * Standard companion into the free third column precisely because it follows
 * that card in the DOM. An unknown tier value (e.g. a stale record from an
 * older API) is treated as Standard rather than trusted.
 */
export const packDirectoryPage = <T extends PlacementListing>(
  listings: readonly T[],
): DirectoryPageSegments<T> => {
  const featuredCards: T[] = []
  const standardCards: T[] = []

  for (const listing of listings) {
    if (listing.tier === 'featured') featuredCards.push(listing)
    else standardCards.push(listing)
  }

  const featured: PlacedListing<T>[] = []
  let cursor = 0

  for (const card of featuredCards) {
    featured.push(place(card, 'directory-spotlight', 'double'))

    const companion = standardCards[cursor]

    // A Featured card without a real companion keeps its two columns and leaves
    // the third honestly empty. Widening it would show a placement the buyer did
    // not purchase, and synthesizing a card would fake a listing.
    if (companion) {
      featured.push(place(companion, 'directory-companion', 'unit'))
      cursor += 1
    }
  }

  const standard = standardCards.slice(cursor).map(l => place(l, 'standard', 'unit'))

  return { featured, standard }
}

/** Later pages, /featured and chronological grids: one uniform card per result. */
export const packUniform = <T extends PlacementListing>(
  listings: readonly T[],
): PlacedListing<T>[] => listings.map(l => place(l, 'standard', 'unit'))

/**
 * Homepage Featured: every buyer receives the same compact catalog cell.
 * The API still rotates the cohort daily, but list order never changes the size
 * of a purchased placement or turns one record into a page-sized banner.
 */
export const packHomepageFeatured = <T extends PlacementListing>(
  listings: readonly T[],
): PlacedListing<T>[] => listings.map(l => place(l, 'standard', 'unit'))

export const composeHomepageListings = <T extends { slug: string }>(
  featured: readonly T[],
  recent: readonly T[],
  featuredLimit: number,
  recentLimit: number,
): HomepageListings<T> => {
  const hero = recent[0] ?? featured[0] ?? null
  const heroSlugs = new Set(hero ? [hero.slug] : [])
  const homepageFeatured = takeListingsWithoutSlugs(featured, heroSlugs, featuredLimit)
  const visibleSlugs = new Set([
    ...heroSlugs,
    ...homepageFeatured.map(listing => listing.slug),
  ])

  return {
    hero,
    featured: homepageFeatured,
    recent: takeListingsWithoutSlugs(recent, visibleSlugs, recentLimit),
  }
}

/** Homepage recent dedupe: drop slugs already shown above, then fill the limit. */
export const takeListingsWithoutSlugs = <T extends { slug: string }>(
  listings: readonly T[],
  excludedSlugs: ReadonlySet<string>,
  limit: number,
): T[] => {
  if (limit <= 0) return []

  return listings.filter(listing => !excludedSlugs.has(listing.slug)).slice(0, limit)
}
