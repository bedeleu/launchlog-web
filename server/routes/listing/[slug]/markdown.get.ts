import { renderListingMarkdown } from '../../../utils/listing-markdown'
import { fetchListingProof, ListingProofError } from '../../../utils/listing-proof'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''

  setResponseHeaders(event, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
  })

  try {
    const { listing, domain } = await fetchListingProof(slug)
    const body = renderListingMarkdown(listing, domain)

    setResponseHeaders(event, {
      'Content-Signal': 'ai-train=yes, search=yes, ai-input=yes',
      'Cache-Control': 'public, s-maxage=3600',
    })
    return body
  }
  catch (error) {
    if (!(error instanceof ListingProofError)) throw error

    setResponseStatus(event, error.status)
    setResponseHeader(event, 'Cache-Control', 'private, no-store')
    return renderListingProofError(error.status)
  }
})

function renderListingProofError(status: 404 | 410 | 503): string {
  if (status === 410) {
    return '# Listing withdrawn\n\n> This listing has been withdrawn and is no longer available.\n'
  }
  if (status === 503) {
    return '# Listing temporarily unavailable\n\n> This listing cannot be loaded right now. Please try again later.\n'
  }
  return '# Listing not found\n\n> This listing does not exist.\n'
}
