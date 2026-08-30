import { buildListingSchema } from '../../../../app/utils/listing-schema'
import { fetchListingProof, ListingProofError } from '../../../utils/listing-proof'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''

  setResponseHeaders(event, {
    'Content-Type': 'application/ld+json; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
  })

  try {
    const { listing, domain } = await fetchListingProof(slug)
    const schema = buildListingSchema(listing, `https://${domain}`)
    const body = JSON.stringify(schema, null, 2)

    setResponseHeader(event, 'Cache-Control', 'public, s-maxage=3600')
    return body
  }
  catch (error) {
    if (!(error instanceof ListingProofError)) throw error

    setResponseStatus(event, error.status)
    setResponseHeader(event, 'Cache-Control', 'private, no-store')
    return JSON.stringify(schemaProofError(error.status))
  }
})

function schemaProofError(status: 404 | 410 | 503): { status: number, error: string } {
  const message = status === 410
    ? 'Listing withdrawn'
    : status === 503
      ? 'Listing temporarily unavailable'
      : 'Listing not found'

  return { status, error: message }
}
