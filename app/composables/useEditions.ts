import type {
  EditionDetail,
  EditionItem,
  EditionPage,
  EditionSummary,
} from '#shared/types/editions'
import { createError } from 'h3'

type Fetcher = (url: string, options?: Record<string, unknown>) => Promise<unknown>

const EDITION_SLUG = /^\d{4}-w(?:0[1-9]|[1-4]\d|5[0-3])$/
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/
const LISTING_PATH = /^\/listing\/[a-z0-9]+(?:-[a-z0-9]+)*$/

function unavailable(): never {
  throw createError({ statusCode: 503, statusMessage: 'Edition source unavailable' })
}

function notFound(): never {
  throw createError({ statusCode: 404, statusMessage: 'Edition not found' })
}

function fetchStatus(error: unknown): number {
  const value = error as {
    statusCode?: unknown
    status?: unknown
    response?: { status?: unknown }
  }

  return Number(value?.statusCode ?? value?.status ?? value?.response?.status ?? 0)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !CALENDAR_DATE.test(value)) return false

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T/.test(value)
    && !Number.isNaN(Date.parse(value))
}

function isSafeHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false

  try {
    return new URL(value).protocol === 'https:'
  }
  catch {
    return false
  }
}

function parseSummary(value: unknown): EditionSummary {
  if (!isRecord(value)) unavailable()

  const {
    slug,
    week_starts_at: weekStartsAt,
    week_ends_at: weekEndsAt,
    introduction,
    published_at: publishedAt,
    modified_at: modifiedAt,
    item_count: itemCount,
    path,
  } = value

  if (typeof slug !== 'string'
    || !EDITION_SLUG.test(slug)
    || !isCalendarDate(weekStartsAt)
    || !isCalendarDate(weekEndsAt)
    || !isNullableString(introduction)
    || !isIsoDateTime(publishedAt)
    || !isIsoDateTime(modifiedAt)
    || !Number.isSafeInteger(itemCount)
    || Number(itemCount) < 0
    || path !== `/shipped/${slug}`) unavailable()

  return {
    slug,
    week_starts_at: weekStartsAt,
    week_ends_at: weekEndsAt,
    introduction,
    published_at: publishedAt,
    modified_at: modifiedAt,
    item_count: Number(itemCount),
    path,
  }
}

function parseItem(value: unknown): EditionItem {
  if (!isRecord(value)) unavailable()

  const {
    kind,
    position,
    shipped_at: shippedAt,
    source_week_starts_at: sourceWeekStartsAt,
    carried_over: carriedOver,
    name,
    tagline,
    tier_label: tierLabel,
    image_url: imageUrl,
    current,
    listing_path: listingPath,
    provenance_url: provenanceUrl,
    include_in_item_list: includeInItemList,
  } = value

  if (kind !== 'new_listing'
    || !Number.isSafeInteger(position)
    || Number(position) < 1
    || !isCalendarDate(shippedAt)
    || !(sourceWeekStartsAt === null || isCalendarDate(sourceWeekStartsAt))
    || typeof carriedOver !== 'boolean'
    || carriedOver !== (sourceWeekStartsAt !== null)
    || typeof name !== 'string'
    || name.trim() === ''
    || !isNullableString(tagline)
    || (tierLabel !== 'Standard' && tierLabel !== 'Featured')
    || !(imageUrl === null || isSafeHttpsUrl(imageUrl))
    || typeof current !== 'boolean'
    || !(listingPath === null || (typeof listingPath === 'string' && LISTING_PATH.test(listingPath)))
    || !(provenanceUrl === null || isSafeHttpsUrl(provenanceUrl))
    || typeof includeInItemList !== 'boolean') unavailable()

  if (current) {
    if (listingPath === null || includeInItemList !== true) unavailable()
  }
  else if (listingPath !== null || provenanceUrl !== null || includeInItemList !== false) {
    unavailable()
  }

  return {
    kind,
    position: Number(position),
    shipped_at: shippedAt,
    source_week_starts_at: sourceWeekStartsAt,
    carried_over: carriedOver,
    name,
    tagline,
    tier_label: tierLabel,
    image_url: imageUrl,
    current,
    listing_path: listingPath,
    provenance_url: provenanceUrl,
    include_in_item_list: includeInItemList,
  }
}

function parseArchive(value: unknown, requestedPage: number): EditionPage {
  if (!isRecord(value) || !Array.isArray(value.data) || !isRecord(value.meta)) unavailable()

  const currentPage = value.meta.current_page
  const lastPage = value.meta.last_page
  const perPage = value.meta.per_page
  const total = value.meta.total

  if (currentPage !== requestedPage
    || !Number.isSafeInteger(lastPage)
    || Number(lastPage) < 1
    || perPage !== 24
    || !Number.isSafeInteger(total)
    || Number(total) < 0
    || requestedPage > Number(lastPage)
    || value.data.length > 24
    || (Number(total) === 0 && (requestedPage !== 1 || Number(lastPage) !== 1 || value.data.length !== 0))) {
    unavailable()
  }

  return {
    data: value.data.map(parseSummary),
    meta: {
      current_page: requestedPage,
      last_page: Number(lastPage),
      per_page: 24,
      total: Number(total),
    },
  }
}

function parseDetail(value: unknown, requestedSlug: string): EditionDetail {
  if (!isRecord(value) || !isRecord(value.data) || !Array.isArray(value.data.items)) unavailable()

  const summary = parseSummary({ ...value.data, item_count: value.data.items.length })
  if (summary.slug !== requestedSlug) unavailable()

  const items = value.data.items.map(parseItem)
  const positions = items.map(item => item.position)
  if (new Set(positions).size !== positions.length
    || positions.some((position, index) => index > 0 && position <= positions[index - 1]!)) unavailable()

  const { item_count: _itemCount, ...detailSummary } = summary
  return { ...detailSummary, items }
}

export function normalizeEditionPage(raw: unknown): number {
  if (raw === undefined || raw === 1 || raw === '1') return 1
  if (typeof raw !== 'string' || !/^[1-9]\d{0,8}$/.test(raw)) {
    throw new TypeError('Invalid edition page')
  }

  const page = Number(raw)
  if (!Number.isSafeInteger(page)) throw new TypeError('Invalid edition page')
  return page
}

export function createEditionClient(fetcher: Fetcher, apiUrl: string) {
  const base = apiUrl.replace(/\/+$/, '')

  return {
    async fetchArchive(page: number): Promise<EditionPage> {
      if (!Number.isSafeInteger(page) || page < 1) notFound()

      try {
        const response = await fetcher(
          `${base}/api/v1/discovery/editions?page=${page}`,
          { timeout: 5000 },
        )
        return parseArchive(response, page)
      }
      catch (error) {
        if (fetchStatus(error) === 404) notFound()
        unavailable()
      }
    },

    async fetchDetail(slug: string): Promise<EditionDetail> {
      if (!EDITION_SLUG.test(slug)) notFound()

      try {
        const response = await fetcher(
          `${base}/api/v1/discovery/editions/${encodeURIComponent(slug)}`,
          { timeout: 5000 },
        )
        return parseDetail(response, slug)
      }
      catch (error) {
        if (fetchStatus(error) === 404) notFound()
        unavailable()
      }
    },
  }
}

export function useEditions() {
  const apiUrl = useRuntimeConfig().public.apiUrl as string
  return createEditionClient($fetch as unknown as Fetcher, apiUrl)
}
