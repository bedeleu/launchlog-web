import { resolveMarkdownRoute } from '../utils/markdown-route'
import { acceptsExplicitMarkdown } from '../utils/markdown'
import { renderListingMarkdown } from '../utils/listing-markdown'
import { fetchListingProof, ListingProofError } from '../utils/listing-proof'

export default defineEventHandler(async (event) => {
  const route = resolveMarkdownRoute(getRequestURL(event).pathname)
  if (route?.kind !== 'listing') return

  appendVaryAccept(event)

  const accept = getRequestHeader(event, 'accept') ?? ''
  if (!acceptsExplicitMarkdown(accept)) return

  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  try {
    const { listing, domain } = await fetchListingProof(route.slug)
    const body = renderListingMarkdown(listing, domain)

    setResponseHeaders(event, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Signal': 'ai-train=yes, search=yes, ai-input=yes',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, s-maxage=3600',
    })

    return body
  }
  catch (error) {
    if (!(error instanceof ListingProofError)) throw error
    return renderListingError(event, error.status)
  }
})

function renderListingError(
  event: Parameters<typeof setResponseStatus>[0],
  status: 404 | 410 | 503,
): string {
  setResponseStatus(event, status)
  setResponseHeaders(event, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  })

  if (status === 410) {
    return '# Listing withdrawn\n\n> This listing has been withdrawn and is no longer available.\n'
  }
  if (status === 503) {
    return '# Listing temporarily unavailable\n\n> This listing cannot be loaded right now. Please try again later.\n'
  }
  return '# Listing not found\n\n> This listing does not exist.\n'
}

function appendVaryAccept(event: Parameters<typeof setResponseHeader>[0]): void {
  const current = getResponseHeader(event, 'Vary')
  const values = String(current ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)

  if (values.some(value => value === '*' || value.toLowerCase() === 'accept')) return
  setResponseHeader(event, 'Vary', [...values, 'Accept'].join(', '))
}
