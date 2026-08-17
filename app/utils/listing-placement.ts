import type { ListingTier } from '../composables/useListings'

/**
 * Card density. The tier is disclosed in the card's bottom ledger register and
 * steps the neutral surface/hairline values; only the `spotlight` variant
 * carries accent chrome.
 *
 * `spotlight` is the homepage editorial lead; `directory-spotlight` is the
 * compact one-row Featured card used inside a directory page. They are separate
 * variants because only the directory one is height-constrained.
 */
export type ListingCardVariant = 'standard' | 'spotlight' | 'directory-spotlight'

/**
 * Semantic grid footprint. The grid component maps these onto Tailwind spans;
 * the packer stays framework-free so it can be unit-tested with bun test.
 *
 * unit   1x1                double     2 cols x 1 row
 * full-short 3 cols x 1 row half-tall  2 cols x 2 rows (homepage lead only)
 *
 * Every directory card is one row tall, so the only two-row span left is
 * the homepage editorial one.
 */
export type PlacementSpan = 'unit' | 'double' | 'half-tall' | 'full-short'

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
      featured.push(place(companion, 'standard', 'unit'))
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
 * Homepage Featured: an elevated editorial arrangement rather than three stacked
 * directory heroes. Which listing takes the lead slot changes daily, because the
 * API rotates the featured cohort.
 */
export const packHomepageFeatured = <T extends PlacementListing>(
  listings: readonly T[],
): PlacedListing<T>[] => {
  const [lead, ...rest] = listings
  if (!lead) return []

  return [
    place(lead, 'spotlight', rest.length ? 'half-tall' : 'full-short'),
    ...rest.map(l => place(l, 'standard', 'unit')),
  ]
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
