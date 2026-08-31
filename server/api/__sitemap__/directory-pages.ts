import { paginationSitemapEntries, parseSitemapPageCountOrThrow } from '../../utils/pagination-sitemap'

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
    const response = await $fetch<unknown>(endpoint, {
      query: sequence.query,
      timeout: 5000,
    })

    if (!isRecord(response) || !isRecord(response.meta)) {
      throw new TypeError('Invalid directory pagination response')
    }

    return paginationSitemapEntries(
      sequence.path,
      parseSitemapPageCountOrThrow(response.meta.last_page),
    )
  }))

  return entries.flat()
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
