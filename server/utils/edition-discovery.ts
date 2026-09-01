import type { EditionPage, EditionSummary } from '#shared/types/editions'
import { createError } from 'h3'

const EDITION_PAGE_SIZE = 24
const MAX_EDITION_PAGES = 1_000
const EDITION_SLUG = /^\d{4}-w(?:0[1-9]|[1-4]\d|5[0-3])$/
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/

type FetchPage = (page: number) => Promise<EditionPage | undefined> | EditionPage | undefined

export interface EditionSitemapUrl {
  loc: string
  lastmod?: string
}

interface TraversalResult {
  rows: EditionSummary[]
  lastPage: number
  total: number
}

function unavailable(): never {
  throw createError({ statusCode: 503, statusMessage: 'Edition discovery unavailable' })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !CALENDAR_DATE.test(value)) return false

  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T/.test(value)
    && !Number.isNaN(Date.parse(value))
}

function parseSummary(value: unknown): EditionSummary {
  if (!isRecord(value)) unavailable()

  const slug = value.slug
  const weekStartsAt = value.week_starts_at
  const weekEndsAt = value.week_ends_at
  const introduction = value.introduction
  const publishedAt = value.published_at
  const modifiedAt = value.modified_at
  const itemCount = value.item_count
  const path = value.path

  if (typeof slug !== 'string'
    || !EDITION_SLUG.test(slug)
    || !isCalendarDate(weekStartsAt)
    || !isCalendarDate(weekEndsAt)
    || !(introduction === null || typeof introduction === 'string')
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

function expectedFinalPageLength(total: number, lastPage: number): number {
  if (total === 0) return 0
  return total - ((lastPage - 1) * EDITION_PAGE_SIZE)
}

function assertNewestFirst(previous: EditionSummary | undefined, current: EditionSummary): void {
  if (!previous) return

  const comparison = current.published_at.localeCompare(previous.published_at)
    || current.slug.localeCompare(previous.slug)
  if (comparison > 0) unavailable()
}

async function fetchPageOrThrow(fetchPage: FetchPage, page: number): Promise<unknown> {
  try {
    return await fetchPage(page)
  }
  catch {
    unavailable()
  }
}

async function traverseEditions(
  fetchPage: FetchPage,
  rowLimit: number | null,
): Promise<TraversalResult> {
  let expectedLastPage: number | null = null
  let expectedTotal: number | null = null
  let previous: EditionSummary | undefined
  const seenSlugs = new Set<string>()
  const rows: EditionSummary[] = []

  for (let page = 1; page <= MAX_EDITION_PAGES; page += 1) {
    const payload = await fetchPageOrThrow(fetchPage, page)
    if (!isRecord(payload) || !Array.isArray(payload.data) || !isRecord(payload.meta)) {
      unavailable()
    }

    const currentPage = payload.meta.current_page
    const lastPage = payload.meta.last_page
    const perPage = payload.meta.per_page
    const total = payload.meta.total

    if (currentPage !== page
      || perPage !== EDITION_PAGE_SIZE
      || !Number.isSafeInteger(lastPage)
      || Number(lastPage) < 1
      || Number(lastPage) > MAX_EDITION_PAGES
      || !Number.isSafeInteger(total)
      || Number(total) < 0
      || Number(lastPage) !== Math.max(1, Math.ceil(Number(total) / EDITION_PAGE_SIZE))
      || page > Number(lastPage)) unavailable()

    if (expectedLastPage === null) {
      expectedLastPage = Number(lastPage)
      expectedTotal = Number(total)
    }
    else if (lastPage !== expectedLastPage || total !== expectedTotal) {
      unavailable()
    }

    const expectedLength = page < Number(lastPage)
      ? EDITION_PAGE_SIZE
      : expectedFinalPageLength(Number(total), Number(lastPage))
    if (payload.data.length !== expectedLength) unavailable()

    for (const value of payload.data) {
      const row = parseSummary(value)
      if (seenSlugs.has(row.slug)) unavailable()
      assertNewestFirst(previous, row)
      seenSlugs.add(row.slug)
      previous = row
      rows.push(row)
    }

    if (page === expectedLastPage || (rowLimit !== null && rows.length >= rowLimit)) {
      return {
        rows: rowLimit === null ? rows : rows.slice(0, rowLimit),
        lastPage: expectedLastPage,
        total: expectedTotal!,
      }
    }
  }

  unavailable()
}

export async function collectEditionSitemapUrls(
  fetchPage: FetchPage,
): Promise<EditionSitemapUrl[]> {
  const { rows, lastPage } = await traverseEditions(fetchPage, null)

  return [
    ...Array.from({ length: Math.max(0, lastPage - 1) }, (_, index) => ({
      loc: `/shipped?page=${index + 2}`,
    })),
    ...rows.map(row => ({ loc: row.path, lastmod: row.modified_at })),
  ]
}

export async function collectEditionSummaries(
  fetchPage: FetchPage,
  limit: number,
): Promise<{ rows: EditionSummary[], total: number }> {
  if (!Number.isSafeInteger(limit) || limit < 1) unavailable()

  const { rows, total } = await traverseEditions(fetchPage, limit)
  return { rows, total }
}
