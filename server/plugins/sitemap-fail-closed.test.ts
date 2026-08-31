import { describe, expect, test } from 'bun:test'

type SitemapSource = string | Record<string, unknown>
type OwnedSourceResolver = (
  sources: SitemapSource[],
  fetcher?: (source: string) => Promise<unknown>,
) => Promise<SitemapSource[]>

async function loadResolver(): Promise<OwnedSourceResolver> {
  // This remains a runtime-only import until the implementation packet creates the module.
  // It keeps the RED failure inside the test rather than breaking collection or typecheck.
  const modulePath = './sitemap-fail-closed'
  const module = await import(modulePath) as { resolveOwnedSitemapSourcesOrThrow?: OwnedSourceResolver }

  if (typeof module.resolveOwnedSitemapSourcesOrThrow !== 'function') {
    throw new Error('resolveOwnedSitemapSourcesOrThrow is not implemented')
  }

  return module.resolveOwnedSitemapSourcesOrThrow
}

describe('owned sitemap source resolution', () => {
  test('embeds a truthful empty owned source', async () => {
    const resolveOwnedSitemapSourcesOrThrow = await loadResolver()

    await expect(resolveOwnedSitemapSourcesOrThrow(
      ['/api/__sitemap__/listing-urls'],
      async () => [],
    )).resolves.toEqual([
      { context: { source: '/api/__sitemap__/listing-urls' }, urls: [] },
    ])
  })

  test('resolves Nuxt Sitemap user fetch sources without dropping their metadata', async () => {
    const resolveOwnedSitemapSourcesOrThrow = await loadResolver()
    const source = { sourceType: 'user', fetch: '/api/__sitemap__/listing-urls' }
    const urls = [{ loc: '/listing/alpha', lastmod: '2026-08-26T10:00:00.000000Z' }]

    await expect(resolveOwnedSitemapSourcesOrThrow([source], async (path) => {
      expect(path).toBe('/api/__sitemap__/listing-urls')
      return urls
    })).resolves.toEqual([
      {
        ...source,
        context: { source: '/api/__sitemap__/listing-urls' },
        urls,
      },
    ])
  })

  test.each([
    null,
    {},
    { data: [] },
    [{}],
    [''],
    [{ loc: '' }],
  ])('rejects malformed owned-source result %#', async (payload) => {
    const resolveOwnedSitemapSourcesOrThrow = await loadResolver()

    await expect(resolveOwnedSitemapSourcesOrThrow(
      ['/api/__sitemap__/listing-urls'],
      async () => payload,
    )).rejects.toMatchObject({ statusCode: 503 })
  })

  test('rejects the whole source set when a later owned source fails', async () => {
    const resolveOwnedSitemapSourcesOrThrow = await loadResolver()

    await expect(resolveOwnedSitemapSourcesOrThrow([
      '/api/__sitemap__/listing-urls',
      '/api/__sitemap__/directory-pages',
    ], async (source) => {
      if (source.endsWith('listing-urls')) return [{ loc: '/listing/alpha' }]

      throw new Error('directory unavailable')
    })).rejects.toMatchObject({ statusCode: 503 })
  })

  test('preserves embedded and external sources without fetching them', async () => {
    const resolveOwnedSitemapSourcesOrThrow = await loadResolver()
    const embedded = { urls: [{ loc: '/static' }] }
    const external = { sourceType: 'user', fetch: 'https://example.test/sitemap.xml' }

    await expect(resolveOwnedSitemapSourcesOrThrow([embedded, external], async () => {
      throw new Error('must not fetch a non-owned source')
    })).resolves.toEqual([embedded, external])
  })
})
