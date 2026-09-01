import { resolveMarkdownRoute } from '../utils/markdown-route'
import { acceptsExplicitMarkdown } from '../utils/markdown'
import { renderListingMarkdown } from '../utils/listing-markdown'
import { fetchListingProof, ListingProofError } from '../utils/listing-proof'
import { createEditionClient, normalizeEditionPage } from '../../app/composables/useEditions'
import {
  renderEditionArchiveMarkdown,
  renderEditionDetailMarkdown,
} from '../utils/edition-markdown'

const EDITION_CACHE_CONTROL = 'public, max-age=0, s-maxage=600, stale-while-revalidate=600'

export default defineEventHandler(async (event) => {
  const route = resolveMarkdownRoute(getRequestURL(event).pathname)
  if (!route || (route.kind !== 'listing'
    && route.kind !== 'edition_archive'
    && route.kind !== 'edition_detail')) return

  appendVaryAccept(event)

  const accept = getRequestHeader(event, 'accept') ?? ''
  if (!acceptsExplicitMarkdown(accept)) return

  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  if (route.kind === 'listing') try {
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

  const editionClient = createEditionClient(
    $fetch as unknown as (url: string, options?: Record<string, unknown>) => Promise<unknown>,
    useRuntimeConfig().public.apiUrl as string,
  )
  const site = getSiteUrl()
  let archivePage: number | undefined

  if (route.kind === 'edition_archive') {
    try {
      archivePage = normalizeEditionPage(getQuery(event).page)
    }
    catch {
      return renderEditionError(event, 404)
    }
  }

  try {
    const body = route.kind === 'edition_archive'
      ? renderEditionArchiveMarkdown(
          await editionClient.fetchArchive(archivePage!),
          site,
        )
      : renderEditionDetailMarkdown(await editionClient.fetchDetail(route.slug), site)

    setResponseHeaders(event, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Signal': 'ai-train=yes, search=yes, ai-input=yes',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': EDITION_CACHE_CONTROL,
    })

    return body
  }
  catch (error) {
    const status = extractStatus(error) === 404 ? 404 : 503
    return renderEditionError(event, status)
  }
})

function renderEditionError(
  event: Parameters<typeof setResponseStatus>[0],
  status: 404 | 503,
): string {
  setResponseStatus(event, status)
  setResponseHeaders(event, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  })

  return status === 404 ? '# Not found\n' : '# Temporarily unavailable\n'
}

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

function extractStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined

  const source = error as Record<string, unknown>
  const direct = source.statusCode ?? source.status
  if (typeof direct === 'number') return direct

  for (const key of ['response', 'data', 'cause', 'error']) {
    const nested = extractStatus(source[key])
    if (nested !== undefined) return nested
  }

  return undefined
}
