export interface PaginationSitemapEntry {
  loc: string
}

export const MAX_SITEMAP_PAGE_COUNT = 1_000

export function parseSitemapPageCountOrThrow(value: unknown): number {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value <= 0
    || value > MAX_SITEMAP_PAGE_COUNT
  ) {
    throw new TypeError('Invalid sitemap page count')
  }

  return value
}

export function paginationSitemapEntries(basePath: string, lastPage: number): PaginationSitemapEntry[] {
  if (!Number.isSafeInteger(lastPage) || lastPage <= 1) return []

  return Array.from({ length: lastPage - 1 }, (_, index) => ({
    loc: `${basePath}?page=${index + 2}`,
  }))
}
