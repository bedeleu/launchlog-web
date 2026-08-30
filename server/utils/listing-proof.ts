import type { Listing } from '../../app/composables/useListings'
import { extractHttpStatus } from '../../shared/utils/listing-http-status'
import { parseSafeHttpsUrl } from './markdown'

interface ListingEnvelope {
  data?: unknown
}

export interface ListingProof {
  listing: Listing
  domain: string
}

type Fetcher = (
  url: string,
  options?: { timeout?: number },
) => Promise<ListingEnvelope>

export class ListingProofError extends Error {
  constructor(public readonly status: 404 | 410 | 503) {
    super(`Listing proof unavailable (${status})`)
  }
}

export async function fetchListingProof(
  slug: string,
  apiUrl?: string,
  fetcher?: Fetcher,
): Promise<ListingProof> {
  const config = apiUrl === undefined ? useRuntimeConfig() : undefined
  const resolvedApiUrl = apiUrl ?? String(config?.public.apiUrl ?? '')
  const domain = config
    ? String(config.public.domain)
    : new URL(resolvedApiUrl).hostname
  const resolvedFetcher = fetcher ?? ($fetch as unknown as Fetcher)

  try {
    const envelope = await resolvedFetcher(
      `${resolvedApiUrl.replace(/\/+$/, '')}/api/v1/listings/${encodeURIComponent(slug)}`,
      { timeout: 5000 },
    )
    const listing = envelope?.data

    if (!isListing(listing, slug)) throw new ListingProofError(503)

    return { listing, domain }
  }
  catch (error) {
    if (error instanceof ListingProofError) throw error

    const status = extractHttpStatus(error)
    throw new ListingProofError(status === 404 ? 404 : status === 410 ? 410 : 503)
  }
}

function isListing(value: unknown, requestedSlug: string): value is Listing {
  if (typeof value !== 'object' || value === null) return false

  const listing = value as Record<string, unknown>
  return isNonEmptyString(listing.slug)
    && listing.slug === requestedSlug
    && isNonEmptyString(listing.name)
    && parseSafeHttpsUrl(listing.url) !== null
    && isNullableString(listing.tagline)
    && isNullableString(listing.description)
    && isNullableValidDate(listing.published_at)
    && Array.isArray(listing.tech_stack)
    && listing.tech_stack.every(item => typeof item === 'string')
    && Array.isArray(listing.tags)
    && listing.tags.every(hasStringName)
    && (listing.category === null || hasStringName(listing.category))
    && (listing.screenshot_url === null || parseSafeHttpsUrl(listing.screenshot_url) !== null)
    && isValidPricing(listing.pricing)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isNullableValidDate(value: unknown): value is string | null {
  return value === null
    || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Date.parse(value)))
}

function hasStringName(value: unknown): boolean {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && typeof (value as Record<string, unknown>).name === 'string'
}

function isValidPricing(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value !== 'object' || Array.isArray(value)) return false

  const pricing = value as Record<string, unknown>
  return isNullableFiniteNumber(pricing.low)
    && isNullableFiniteNumber(pricing.high)
    && (pricing.low !== null || pricing.high !== null)
    && isNonEmptyString(pricing.currency)
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}
