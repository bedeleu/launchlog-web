export interface PaginationSitemapEntry {
  loc: string
}

export function paginationSitemapEntries(basePath: string, lastPage: number): PaginationSitemapEntry[] {
  if (!Number.isSafeInteger(lastPage) || lastPage <= 1) return []

  return Array.from({ length: lastPage - 1 }, (_, index) => ({
    loc: `${basePath}?page=${index + 2}`,
  }))
}
