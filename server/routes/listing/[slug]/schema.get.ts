import { buildListingSchema } from '../../../../app/utils/listing-schema'
import { fetchListingProof } from '../../../utils/listing-proof'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  const { listing, domain } = await fetchListingProof(slug)
  const schema = buildListingSchema(listing, `https://${domain}`)

  setResponseHeaders(event, {
    'Content-Type': 'application/ld+json; charset=utf-8',
    'Cache-Control': 'public, s-maxage=3600',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
  })

  return JSON.stringify(schema, null, 2)
})
