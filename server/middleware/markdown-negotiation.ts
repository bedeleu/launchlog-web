/*
 * D-009 "invisible tech edge" — pillar #3 of three.
 *
 * Every /listing/{slug} URL returns markdown when called with Accept: text/markdown.
 * Same URL, different format. Cloudflare's "Markdown for Agents" pattern.
 *
 * Phase 0 skeleton: returns early on non-/listing/ paths and on missing markdown Accept.
 * Real implementation lands in Phase 3 when listings exist (Section 9.3 of PRD-MVP.md) —
 * at that point this middleware will fetch the listing from the API, render it as markdown,
 * and set the proper Vary / Content-Signal / Cache-Control headers.
 */
import {
  listingAbsenceStatus,
  type ListingAbsenceStatus,
} from '#shared/utils/listing-http-status'
import type { Listing } from '../../app/composables/useListings'
import { renderListingMarkdown } from '../utils/listing-markdown'

// The API wraps the resource in a JsonResource envelope.
interface ListingEnvelope {
  data?: Listing | null
}

export default defineEventHandler(async (event) => {
  const accept = getRequestHeader(event, 'accept') ?? ''
  if (!accept.includes('text/markdown')) return

  const url = getRequestURL(event)
  if (!url.pathname.startsWith('/listing/')) return

  const slug = url.pathname.replace('/listing/', '').replace(/\/$/, '')
  if (!slug) return

  // Only the listing URL itself negotiates. /listing/{slug}/markdown and
  // /listing/{slug}/schema are the dedicated proof artifacts and own their own
  // representation, so this middleware must not swallow them: it used to treat
  // "{slug}/markdown" as a slug, miss it upstream, and answer the AI clients the
  // feature exists for with a 404 on the very routes the record links to.
  if (slug.includes('/')) return

  const config = useRuntimeConfig()

  try {
    // NUXT_PUBLIC_API_URL is the host only (e.g. https://api.launchlog.ai), without the /api prefix.
    // The Laravel routes/api.php is mounted under apiPrefix: 'api' (bootstrap/app.php), so callers must
    // include /api/v1/... in the path. See D-051 / plan v5 Resolved upfront point 5.
    // The API wraps the resource in a JsonResource envelope ({ data: {...} }).
    const envelope = await $fetch<ListingEnvelope>(`${config.public.apiUrl}/api/v1/listings/${slug}`)
    const listing = envelope?.data ?? null
    const absenceStatus = listingAbsenceStatus(undefined, listing)
    if (absenceStatus || !listing) {
      return renderMissingListing(event, slug, absenceStatus ?? 404)
    }

    setResponseHeaders(event, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Vary': 'Accept',
      'Content-Signal': 'ai-train=yes, search=yes, ai-input=yes',
      'Cache-Control': 's-maxage=3600',
    })

    return renderListingMarkdown(listing, config.public.domain as string)
  }
  catch (error) {
    const absenceStatus = listingAbsenceStatus(error, undefined)
    if (absenceStatus) return renderMissingListing(event, slug, absenceStatus)
    throw error
  }
})

function renderMissingListing(
  event: Parameters<typeof setResponseStatus>[0],
  slug: string,
  status: ListingAbsenceStatus,
): string {
  setResponseStatus(event, status)
  setResponseHeaders(event, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Vary': 'Accept',
    'X-Robots-Tag': 'noindex, nofollow',
  })

  return status === 410
    ? `# Listing withdrawn\n\n> Listing \`${slug}\` has been withdrawn and is no longer available.\n`
    : `# Listing not found\n\n> Listing \`${slug}\` does not exist.\n`
}
