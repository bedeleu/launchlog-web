import { expect, test } from 'bun:test'
import { toListingSitemapEntries } from './discovery'

type DiscoveryListingParser = (payload: unknown) => Array<{
  slug: string
  name: string
  tagline: string | null
  updated_at: string
}>

async function loadDiscoveryListingParser(): Promise<DiscoveryListingParser> {
  // Deliberately dynamic until the implementation packet adds the shared parser.
  const modulePath = './discovery'
  const module = await import(modulePath) as { parseDiscoveryListingsOrThrow?: DiscoveryListingParser }

  if (typeof module.parseDiscoveryListingsOrThrow !== 'function') {
    throw new Error('parseDiscoveryListingsOrThrow is not implemented')
  }

  return module.parseDiscoveryListingsOrThrow
}

test('maps discovery rows to canonical listing sitemap entries', () => {
  expect(toListingSitemapEntries([
    { slug: 'alpha', name: 'Alpha', tagline: 'A', updated_at: '2026-08-01T10:00:00.000000Z' },
    { slug: 'beta', name: 'Beta', tagline: null, updated_at: '2026-08-01T11:00:00.000000Z' },
  ], 'https://launchlog.ai')).toEqual([
    { loc: 'https://launchlog.ai/listing/alpha', lastmod: '2026-08-01T10:00:00.000000Z' },
    { loc: 'https://launchlog.ai/listing/beta', lastmod: '2026-08-01T11:00:00.000000Z' },
  ])
})

test('accepts a truthful empty discovery listing array', async () => {
  const parseDiscoveryListingsOrThrow = await loadDiscoveryListingParser()

  expect(parseDiscoveryListingsOrThrow([])).toEqual([])
})

test('returns a complete current discovery listing array unchanged', async () => {
  const parseDiscoveryListingsOrThrow = await loadDiscoveryListingParser()
  const listings = [
    { slug: 'alpha', name: 'Alpha', tagline: 'A', updated_at: '2026-08-01T10:00:00.000000Z' },
    { slug: 'beta', name: 'Beta', tagline: null, updated_at: '2026-08-01T11:00:00.000000Z' },
  ]

  expect(parseDiscoveryListingsOrThrow(listings)).toEqual(listings)
  expect(parseDiscoveryListingsOrThrow(listings)).toBe(listings)
})

test.each([
  { slug: 'alpha\nbeta', name: 'Alpha', tagline: null, updated_at: '2026-08-01T10:00:00.000000Z' },
  { slug: '../alpha', name: 'Alpha', tagline: null, updated_at: '2026-08-01T10:00:00.000000Z' },
  { slug: 'Alpha', name: 'Alpha', tagline: null, updated_at: '2026-08-01T10:00:00.000000Z' },
  { slug: 'alpha beta', name: 'Alpha', tagline: null, updated_at: '2026-08-01T10:00:00.000000Z' },
  { slug: 'alpha-', name: 'Alpha', tagline: null, updated_at: '2026-08-01T10:00:00.000000Z' },
])('rejects hostile canonical listing slugs %#', async (listing) => {
  const parseDiscoveryListingsOrThrow = await loadDiscoveryListingParser()

  expect(() => parseDiscoveryListingsOrThrow([listing])).toThrow(TypeError)
})

test.each([
  '2026-02-29T10:00:00Z',
  '2026-04-31T10:00:00Z',
  '2026-08-01T24:00:00Z',
  '2026-08-01T10:00:00',
  '2026-08-01T10:00:00+24:00',
  '2026-08-01T10:00:00+10:60',
  '2026-08-01T10:00:00.1234567Z',
])('rejects invalid canonical timestamps %#', async (updated_at) => {
  const parseDiscoveryListingsOrThrow = await loadDiscoveryListingParser()
  const listing = { slug: 'alpha', name: 'Alpha', tagline: null, updated_at }

  expect(() => parseDiscoveryListingsOrThrow([listing])).toThrow(TypeError)
})

test.each([
  null,
  {},
  { data: [] },
  [{ name: 'Alpha', tagline: null, updated_at: '2026-08-01T10:00:00.000000Z' }],
  [{ slug: '', name: 'Alpha', tagline: null, updated_at: '2026-08-01T10:00:00.000000Z' }],
  [{ slug: 1, name: 'Alpha', tagline: null, updated_at: '2026-08-01T10:00:00.000000Z' }],
  [{ slug: 'alpha', tagline: null, updated_at: '2026-08-01T10:00:00.000000Z' }],
  [{ slug: 'alpha', name: '', tagline: null, updated_at: '2026-08-01T10:00:00.000000Z' }],
  [{ slug: 'alpha', name: 1, tagline: null, updated_at: '2026-08-01T10:00:00.000000Z' }],
  [{ slug: 'alpha', name: 'Alpha', tagline: undefined, updated_at: '2026-08-01T10:00:00.000000Z' }],
  [{ slug: 'alpha', name: 'Alpha', tagline: 42, updated_at: '2026-08-01T10:00:00.000000Z' }],
  [{ slug: 'alpha', name: 'Alpha', tagline: null }],
  [{ slug: 'alpha', name: 'Alpha', tagline: null, updated_at: '' }],
  [{ slug: 'alpha', name: 'Alpha', tagline: null, updated_at: null }],
])('rejects malformed discovery listing payload %#', async (payload) => {
  const parseDiscoveryListingsOrThrow = await loadDiscoveryListingParser()

  expect(() => parseDiscoveryListingsOrThrow(payload)).toThrow()
})
