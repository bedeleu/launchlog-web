import { describe, expect, test } from 'bun:test'
import { paginationSitemapEntries } from './pagination-sitemap'

type SitemapPageCountParser = (value: unknown) => number

async function loadSitemapPageCountParser(): Promise<SitemapPageCountParser> {
  // Deliberately dynamic until the implementation packet adds the strict parser.
  const modulePath = './pagination-sitemap'
  const module = await import(modulePath) as { parseSitemapPageCountOrThrow?: SitemapPageCountParser }

  if (typeof module.parseSitemapPageCountOrThrow !== 'function') {
    throw new Error('parseSitemapPageCountOrThrow is not implemented')
  }

  return module.parseSitemapPageCountOrThrow
}

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

  test.each([1, 2, 1_000])('accepts a bounded positive safe page count %#', async (value) => {
    const parseSitemapPageCountOrThrow = await loadSitemapPageCountParser()

    expect(parseSitemapPageCountOrThrow(value)).toBe(value)
  })

  test.each([
    undefined,
    null,
    '1',
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1_001,
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects an invalid page count %#', async (value) => {
    const parseSitemapPageCountOrThrow = await loadSitemapPageCountParser()

    expect(() => parseSitemapPageCountOrThrow(value)).toThrow(TypeError)
  })
})
