export interface DiscoveryListing {
  slug: string
  name: string
  tagline: string | null
  updated_at: string
}

const CANONICAL_LISTING_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ISO_OFFSET_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/

export function parseDiscoveryListingsOrThrow(payload: unknown): DiscoveryListing[] {
  if (!Array.isArray(payload)) {
    throw new TypeError('Invalid discovery listing data')
  }

  for (const listing of payload) {
    if (!isDiscoveryListing(listing)) {
      throw new TypeError('Invalid discovery listing data')
    }
  }

  return payload
}

export const toListingSitemapEntries = (listings: DiscoveryListing[], site: string) =>
  listings.map(listing => ({
    loc: `${site}/listing/${listing.slug}`,
    lastmod: listing.updated_at,
  }))

function isDiscoveryListing(value: unknown): value is DiscoveryListing {
  if (!isRecord(value)) return false

  return isCanonicalListingSlug(value.slug)
    && isTrimmedNonEmptyString(value.name)
    && (typeof value.tagline === 'string' || value.tagline === null)
    && isIsoOffsetTimestamp(value.updated_at)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTrimmedNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isCanonicalListingSlug(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_LISTING_SLUG_PATTERN.test(value)
}

function isIsoOffsetTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false

  const match = ISO_OFFSET_TIMESTAMP_PATTERN.exec(value)
  if (!match) return false

  const [, yearString, monthString, dayString, hourString, minuteString, secondString, offsetHourString, offsetMinuteString] = match
  const year = Number(yearString)
  const month = Number(monthString)
  const day = Number(dayString)
  const hour = Number(hourString)
  const minute = Number(minuteString)
  const second = Number(secondString)

  if (
    month < 1
    || month > 12
    || day < 1
    || day > daysInMonth(year, month)
    || hour > 23
    || minute > 59
    || second > 59
  ) {
    return false
  }

  return offsetHourString === undefined
    || (Number(offsetHourString) <= 23 && Number(offsetMinuteString) <= 59)
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28

  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}
