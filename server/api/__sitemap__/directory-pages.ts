import { paginationSitemapEntries } from '../../utils/pagination-sitemap'

interface PaginationResponse {
  meta?: {
    last_page?: number
  }
}

interface DirectorySequence {
  path: string
  query: Record<string, string | number>
}

export default defineSitemapEventHandler(async () => {
  const config = useRuntimeConfig()
  const endpoint = `${config.public.apiUrl}/api/v1/listings`
  const sequences: DirectorySequence[] = [
    {
      path: '/browse-all',
      query: { view: 'directory', sort: 'priority', page: 1 },
    },
    {
      path: '/tech-products',
      query: { view: 'directory', kind: 'tech', sort: 'priority', page: 1 },
    },
    {
      path: '/featured',
      query: { tier: 'featured', sort: 'priority', per_page: 24, page: 1 },
    },
  ]

  const entries = await Promise.all(sequences.map(async (sequence) => {
    try {
      const response = await $fetch<PaginationResponse>(endpoint, {
        query: sequence.query,
        timeout: 5000,
      })

      return paginationSitemapEntries(sequence.path, Number(response.meta?.last_page ?? 1))
    }
    catch {
      return []
    }
  }))

  return entries.flat()
})
