import { expect, test } from 'bun:test'
import { toListingSitemapEntries } from './discovery'

test('maps discovery rows to canonical listing sitemap entries', () => {
  expect(toListingSitemapEntries([
    { slug: 'alpha', name: 'Alpha', tagline: 'A', updated_at: '2026-08-01T10:00:00.000000Z' },
    { slug: 'beta', name: 'Beta', tagline: null, updated_at: '2026-08-01T11:00:00.000000Z' },
  ], 'https://launchlog.ai')).toEqual([
    { loc: 'https://launchlog.ai/listing/alpha', lastmod: '2026-08-01T10:00:00.000000Z' },
    { loc: 'https://launchlog.ai/listing/beta', lastmod: '2026-08-01T11:00:00.000000Z' },
  ])
})
