import { describe, expect, test } from 'bun:test'
import { paginationSitemapEntries } from './pagination-sitemap'

describe('pagination sitemap entries', () => {
  test('adds every canonical page after the base route', () => {
    expect(paginationSitemapEntries('/browse-all', 4)).toEqual([
      { loc: '/browse-all?page=2' },
      { loc: '/browse-all?page=3' },
      { loc: '/browse-all?page=4' },
    ])
  })

  test('does not duplicate page one or emit invalid page counts', () => {
    expect(paginationSitemapEntries('/blog', 1)).toEqual([])
    expect(paginationSitemapEntries('/blog', Number.NaN)).toEqual([])
  })
})
