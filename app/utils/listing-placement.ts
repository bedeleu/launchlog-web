import type { ListingTier } from '../composables/useListings'

/** Card density. Tier chrome (accent, badge, sparkles) comes from listing.tier. */
export type ListingCardVariant = 'standard' | 'wide' | 'spotlight'

/**
 * Semantic grid footprint. The grid component maps these onto Tailwind spans;
 * the packer stays framework-free so it can be unit-tested with bun test.
 *
 * unit       1x1   half-tall  2 cols x 2 rows
 * full-tall  3 cols x 2 rows  full-short 3 cols x 1 row
 */
export type PlacementSpan = 'unit' | 'half-tall' | 'full-tall' | 'full-short'

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
 * Page-one bento for mixed sort=priority surfaces.
 *
 * The API has already ordered the page (tier-major, daily-rotated inside each
 * tier), so this only groups and assigns footprints — it must never re-sort or
 * re-rotate. Emission order matters: CSS grid sparse auto-placement puts the two
 * basic companions in the third column beside a 2x2 premium precisely because
 * they follow it in the DOM.
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

  const packed: PlacedListing<T>[] = featured.map(l => place(l, 'spotlight', 'full-tall'))
  let cursor = 0

  for (const block of premium) {
    const companions = basic.slice(cursor, cursor + 2)

    if (companions.length === 2) {
      // A 2x2 premium leaves exactly one column free for two stacked 1x1 cards.
      packed.push(place(block, 'wide', 'half-tall'))
      packed.push(...companions.map(l => place(l, 'standard', 'unit')))
      cursor += 2
      continue
    }

    // Fewer than two companions would leave a visible hole beside the block, so
    // the premium placement goes full width instead.
    packed.push(place(block, 'wide', 'full-short'))
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
