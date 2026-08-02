export interface DiscoveryListing {
  slug: string
  name: string
  tagline: string | null
  updated_at: string
}

export const toListingSitemapEntries = (listings: DiscoveryListing[], site: string) =>
  listings.map(listing => ({
    loc: `${site}/listing/${listing.slug}`,
    lastmod: listing.updated_at,
  }))
