import { describe, expect, test } from 'bun:test'
import type { EditionPage, EditionSummary } from '#shared/types/editions'

type FetchPage = (page: number) => Promise<EditionPage | undefined> | EditionPage | undefined
type SitemapUrl = { loc: string, lastmod?: string }
type EditionCollectors = {
  collectEditionSitemapUrls: (fetchPage: FetchPage) => Promise<SitemapUrl[]>
  collectEditionSummaries: (
    fetchPage: FetchPage,
    limit: number,
  ) => Promise<{ rows: EditionSummary[], total: number }>
}

async function loadCollectors(): Promise<EditionCollectors> {
  const modulePath = './edition-discovery'
  const module = await import(modulePath) as Partial<EditionCollectors>
  if (typeof module.collectEditionSitemapUrls !== 'function'
    || typeof module.collectEditionSummaries !== 'function') {
    throw new Error('Edition discovery collectors are not implemented')
  }
  return module as EditionCollectors
}

const summary = (index: number): EditionSummary => {
  const ordinal = 106 - index
  const year = 2025 + Math.floor((ordinal - 1) / 53)
  const week = String(((ordinal - 1) % 53) + 1).padStart(2, '0')
  const publishedAt = new Date(Date.UTC(2026, 7, 31 - index)).toISOString()
  const modifiedAt = new Date(Date.UTC(2026, 7, 31 - index, 0, 5)).toISOString()
  return {
    slug: `${year}-w${week}`,
    week_starts_at: '2026-08-24',
    week_ends_at: '2026-08-30',
    introduction: `Edition ${index}`,
    published_at: publishedAt,
    modified_at: modifiedAt,
    item_count: 1,
    path: `/shipped/${year}-w${week}`,
  }
}

const pagesFor = (rows: EditionSummary[]): Map<number, EditionPage> => {
  const lastPage = Math.max(1, Math.ceil(rows.length / 24))
  const pages = new Map<number, EditionPage>()

  for (let page = 1; page <= lastPage; page += 1) {
    pages.set(page, {
      data: rows.slice((page - 1) * 24, page * 24),
      meta: { current_page: page, last_page: lastPage, per_page: 24, total: rows.length },
    })
  }

  return pages
}

describe('edition discovery traversal', () => {
  test('keeps a truthful empty archive discoverable', async () => {
    const { collectEditionSitemapUrls, collectEditionSummaries } = await loadCollectors()
    const empty: EditionPage = {
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 24, total: 0 },
    }

    // Nuxt owns the static /shipped route. The dynamic source must not duplicate page one.
    await expect(collectEditionSitemapUrls(() => empty)).resolves.toEqual([])
    await expect(collectEditionSummaries(() => empty, 53)).resolves.toEqual({ rows: [], total: 0 })
  })

  test('walks every archive page and detail exactly once with authoritative lastmod', async () => {
    const { collectEditionSitemapUrls } = await loadCollectors()
    const rows = Array.from({ length: 25 }, (_, index) => summary(index))
    const pages = pagesFor(rows)
    const requested: number[] = []

    const urls = await collectEditionSitemapUrls(async (page) => {
      requested.push(page)
      return pages.get(page)
    })

    expect(requested).toEqual([1, 2])
    expect(urls[0]).toEqual({ loc: '/shipped?page=2' })
    expect(urls.slice(1)).toEqual(rows.map(row => ({ loc: row.path, lastmod: row.modified_at })))
    expect(new Set(urls.map(url => url.loc)).size).toBe(urls.length)
  })

  test('bounds llms collection at 53 rows while retaining authoritative total', async () => {
    const { collectEditionSummaries } = await loadCollectors()
    const rows = Array.from({ length: 60 }, (_, index) => summary(index))
    const pages = pagesFor(rows)
    const requested: number[] = []

    const result = await collectEditionSummaries(async (page) => {
      requested.push(page)
      return pages.get(page)
    }, 53)

    expect(requested).toEqual([1, 2, 3])
    expect(result.rows).toHaveLength(53)
    expect(result.total).toBe(60)
    expect(result.rows).toEqual([...result.rows].sort((left, right) =>
      right.published_at.localeCompare(left.published_at) || right.slug.localeCompare(left.slug)))
  })

  test.each([
    ['undefined page', undefined],
    ['malformed page', { data: {}, meta: {} }],
    ['wrong per-page contract', {
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 12, total: 0 },
    }],
  ])('fails both consumers closed on %s', async (_name, payload) => {
    const { collectEditionSitemapUrls, collectEditionSummaries } = await loadCollectors()
    const fetchPage = async (): Promise<EditionPage | undefined> =>
      payload as EditionPage | undefined

    await expect(collectEditionSitemapUrls(fetchPage)).rejects.toMatchObject({ statusCode: 503 })
    await expect(collectEditionSummaries(fetchPage, 53))
      .rejects.toMatchObject({ statusCode: 503 })
  })

  test('rejects stable metadata whose last page contradicts total and per-page', async () => {
    const { collectEditionSitemapUrls, collectEditionSummaries } = await loadCollectors()
    const rows = Array.from({ length: 48 }, (_, index) => summary(index))
    const fetchPage = async (page: number): Promise<EditionPage | undefined> => ({
      data: page <= 2 ? rows.slice((page - 1) * 24, page * 24) : [],
      meta: { current_page: page, last_page: 3, per_page: 24, total: 48 },
    })

    await expect(collectEditionSitemapUrls(fetchPage)).rejects.toMatchObject({ statusCode: 503 })
    await expect(collectEditionSummaries(fetchPage, 53))
      .rejects.toMatchObject({ statusCode: 503 })
  })

  test.each([
    ['inconsistent last page', (pages: Map<number, EditionPage>) => {
      pages.get(2)!.meta.last_page = 3
    }],
    ['inconsistent total', (pages: Map<number, EditionPage>) => {
      pages.get(2)!.meta.total = 26
    }],
    ['short intermediate page', (pages: Map<number, EditionPage>) => {
      pages.get(1)!.data.pop()
    }],
    ['wrong final cardinality', (pages: Map<number, EditionPage>) => {
      pages.get(2)!.data = []
    }],
    ['duplicate slug', (pages: Map<number, EditionPage>) => {
      pages.get(2)!.data[0] = pages.get(1)!.data[0]!
    }],
    ['non deterministic edition order', (pages: Map<number, EditionPage>) => {
      const first = pages.get(1)!.data[0]!
      pages.get(1)!.data[0] = pages.get(1)!.data[1]!
      pages.get(1)!.data[1] = first
    }],
    ['non advancing current page', (pages: Map<number, EditionPage>) => {
      pages.get(2)!.meta.current_page = 1
    }],
  ])('fails closed on %s', async (_name, mutate) => {
    const { collectEditionSitemapUrls, collectEditionSummaries } = await loadCollectors()
    const sitemapPages = pagesFor(Array.from({ length: 25 }, (_, index) => summary(index)))
    mutate(sitemapPages)

    await expect(collectEditionSitemapUrls(page => sitemapPages.get(page)))
      .rejects.toMatchObject({ statusCode: 503 })

    const llmsPages = pagesFor(Array.from({ length: 25 }, (_, index) => summary(index)))
    mutate(llmsPages)
    await expect(collectEditionSummaries(page => llmsPages.get(page), 53))
      .rejects.toMatchObject({ statusCode: 503 })
  })

  test('fails closed before traversing more than 1000 pages', async () => {
    const { collectEditionSitemapUrls, collectEditionSummaries } = await loadCollectors()
    const fetchPage = async (page: number): Promise<EditionPage> => ({
      data: Array.from({ length: 24 }, (_, index) => summary((page - 1) * 24 + index)),
      meta: { current_page: page, last_page: 1001, per_page: 24, total: 24_001 },
    })

    await expect(collectEditionSitemapUrls(fetchPage)).rejects.toMatchObject({ statusCode: 503 })
    await expect(collectEditionSummaries(fetchPage, 53)).rejects.toMatchObject({ statusCode: 503 })
  })
})
