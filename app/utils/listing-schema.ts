import type { Listing } from '../composables/useListings'

export const buildListingSchema = (
  listing: Listing,
  siteUrl: string,
): Record<string, unknown> => {
  const baseUrl = siteUrl.replace(/\/$/, '')
  const pageUrl = `${baseUrl}/listing/${listing.slug}`

  const organization = {
    '@type': 'Organization',
    '@id': `${baseUrl}/#organization`,
    'name': 'LaunchLog',
    'url': baseUrl,
  }

  const website = {
    '@type': 'WebSite',
    '@id': `${baseUrl}/#website`,
    'name': 'LaunchLog',
    'url': baseUrl,
    'publisher': { '@id': `${baseUrl}/#organization` },
  }

  const product: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    '@id': `${pageUrl}#product`,
    'name': listing.name,
    'url': listing.url,
    'applicationCategory': listing.category?.name ?? 'WebApplication',
    'isPartOf': { '@id': `${baseUrl}/#website` },
  }

  const description = listing.description ?? listing.tagline
  if (description) product.description = description
  if (listing.screenshot_url) product.image = listing.screenshot_url
  if (listing.tech_stack?.length) product.featureList = listing.tech_stack
  const pricing = listing.pricing
  const price = pricing?.low ?? pricing?.high
  if (pricing && typeof price === 'number' && Number.isFinite(price) && pricing.currency.trim() !== '') {
    product.offers = {
      '@type': 'Offer',
      'price': price,
      'priceCurrency': pricing.currency,
      'url': listing.url,
    }
  }

  const breadcrumbs = {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': baseUrl },
      { '@type': 'ListItem', 'position': 2, 'name': 'Browse', 'item': `${baseUrl}/browse-all` },
      { '@type': 'ListItem', 'position': 3, 'name': listing.name, 'item': pageUrl },
    ],
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [organization, website, product, breadcrumbs],
  }
}
