import type { ListingTier } from '../composables/useListings'

/**
 * Card density. Tier chrome (accent, badge, sparkles) comes from listing.tier.
 *
 * `spotlight` is the homepage editorial lead; `directory-spotlight` is the
 * compact one-row Featured card used inside a directory page. They are separate
 * variants because only the directory one is height-constrained.
 */
export type ListingCardVariant = 'standard' | 'wide' | 'spotlight' | 'directory-spotlight'

/**
 * Semantic grid footprint. The grid component maps these onto Tailwind spans;
 * the packer stays framework-free so it can be unit-tested with bun test.
 *
 * unit   1x1                double     2 cols x 1 row
 * full-short 3 cols x 1 row half-tall  2 cols x 2 rows (homepage lead only)
 *
 * Every mixed directory card is one row tall, so the only two-row span left is
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

const place = <T>(listing: T, variant: ListingCardVariant, span: PlacementSpan): PlacedListing<T> =>
  ({ listing, variant, span })

/**
 * Footprints for a mixed sort=priority directory page.
 *
 * The API owns page membership: it plans thirty visual slots (ten rows of three
 * columns, Featured 3, Premium 2, Basic 1) and returns exactly the real records
 * that fill them, already ordered tier-major and daily-rotated inside each tier.
 * This function therefore only assigns footprints — it must never re-sort,
 * re-rotate, count slots, paginate or invent a card.
 *
 * Emission order matters: CSS grid auto-placement drops a premium's basic
 * companion into the free third column precisely because it follows the premium
 * in the DOM.
 */
export const packMixedTierPage = <T extends PlacementListing>(
  listings: readonly T[],
): PlacedListing<T>[] => {
  const featured: T[] = []
  const premium: T[] = []
  const basic: T[] = []

  for (const listing of listings) {
    if (listing.tier === 'featured') featured.push(listing)
    else if (listing.tier === 'premium') premium.push(listing)
    else basic.push(listing)
  }

  const packed: PlacedListing<T>[] = featured.map(l => place(l, 'directory-spotlight', 'full-short'))
  let cursor = 0

  for (const block of premium) {
    packed.push(place(block, 'wide', 'double'))

    const companion = basic[cursor]

    // A premium without a real companion keeps its two columns and leaves the
    // third honestly empty. Widening it would show a full-width placement the
    // buyer did not purchase, and synthesizing a card would fake a listing.
    if (companion) {
      packed.push(place(companion, 'standard', 'unit'))
      cursor += 1
    }
  }

  packed.push(...basic.slice(cursor).map(l => place(l, 'standard', 'unit')))

  return packed
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
