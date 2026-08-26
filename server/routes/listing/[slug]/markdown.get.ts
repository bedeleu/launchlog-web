import { renderListingMarkdown } from '../../../utils/listing-markdown'
import { fetchListingProof } from '../../../utils/listing-proof'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  const { listing, domain } = await fetchListingProof(slug)

  setResponseHeaders(event, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Signal': 'ai-train=yes, search=yes, ai-input=yes',
    'Cache-Control': 'public, s-maxage=3600',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
  })

  return renderListingMarkdown(listing, domain)
})
