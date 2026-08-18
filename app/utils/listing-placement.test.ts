import type { PlacementListing } from './listing-placement'
import { describe, expect, test } from 'bun:test'
import { packDirectoryPage, packHomepageFeatured, packUniform, takeListingsWithoutSlugs } from './listing-placement'

const item = (slug: string, tier: PlacementListing['tier'] | string): PlacementListing =>
  ({ slug, tier: tier as PlacementListing['tier'] })

const slugsOf = (placed: Array<{ listing: PlacementListing }>) => placed.map(p => p.listing.slug)

describe('packDirectoryPage', () => {
  test('splits one API page into featured rows and the standard grid', () => {
    const page = packDirectoryPage([
      item('f1', 'featured'),
      item('f2', 'featured'),
      item('b1', 'basic'),
      item('b2', 'basic'),
      item('b3', 'basic'),
      item('b4', 'basic'),
    ])

    // Each featured card is immediately followed by its real standard companion
    // so grid auto-placement drops the companion into the free third column.
    expect(slugsOf(page.featured)).toEqual(['f1', 'b1', 'f2', 'b2'])
    expect(page.featured.map(p => p.variant)).toEqual([
      'directory-spotlight',
      'standard',
      'directory-spotlight',
      'standard',
    ])
    expect(page.featured.map(p => p.span)).toEqual(['double', 'unit', 'double', 'unit'])
    expect(slugsOf(page.standard)).toEqual(['b3', 'b4'])
    expect(page.standard.every(p => p.variant === 'standard' && p.span === 'unit')).toBeTrue()
  })

  test('a page without featured records renders as a plain standard grid', () => {
    const page = packDirectoryPage([item('b1', 'basic'), item('b2', 'basic')])

    expect(page.featured).toEqual([])
    expect(slugsOf(page.standard)).toEqual(['b1', 'b2'])
  })

  test('a featured card without a companion keeps its two columns honestly', () => {
    const page = packDirectoryPage([item('f1', 'featured'), item('f2', 'featured')])

    expect(slugsOf(page.featured)).toEqual(['f1', 'f2'])
    expect(page.featured.every(p => p.span === 'double')).toBeTrue()
    expect(page.standard).toEqual([])
  })

  test('never duplicates or drops a listing across the two segments', () => {
    const input = [
      item('f1', 'featured'),
      item('b1', 'basic'),
      item('b2', 'basic'),
      item('f2', 'featured'),
      item('b3', 'basic'),
    ]

    const page = packDirectoryPage(input)
    const all = [...slugsOf(page.featured), ...slugsOf(page.standard)]

    expect(all.toSorted()).toEqual(input.map(l => l.slug).toSorted())
    expect(new Set(all).size).toBe(all.length)
  })

  test('treats an unknown tier value as standard instead of trusting it', () => {
    const page = packDirectoryPage([item('f1', 'featured'), item('x1', 'premium')])

    expect(slugsOf(page.featured)).toEqual(['f1', 'x1'])
    expect(page.featured[1]!.variant).toBe('standard')
  })
})

describe('packUniform', () => {
  test('gives every result one uniform cell', () => {
    const placed = packUniform([item('f1', 'featured'), item('b1', 'basic')])

    expect(placed.every(p => p.variant === 'standard' && p.span === 'unit')).toBeTrue()
  })
})

describe('packHomepageFeatured', () => {
  test('gives every featured listing the same one-row homepage placement', () => {
    const placed = packHomepageFeatured([
      item('f1', 'featured'),
      item('f2', 'featured'),
      item('f3', 'featured'),
    ])

    expect(placed.map(p => p.listing.slug)).toEqual(['f1', 'f2', 'f3'])
    expect(placed.every(p => p.variant === 'spotlight' && p.span === 'full-short')).toBeTrue()
  })

  test('a single listing uses the same full-width card contract', () => {
    const placed = packHomepageFeatured([item('f1', 'featured')])

    expect(placed).toHaveLength(1)
    expect(placed[0]!.variant).toBe('spotlight')
    expect(placed[0]!.span).toBe('full-short')
  })

  test('returns nothing for an empty cohort', () => {
    expect(packHomepageFeatured([])).toEqual([])
  })
})

describe('takeListingsWithoutSlugs', () => {
  test('drops excluded slugs then honours the limit', () => {
    const result = takeListingsWithoutSlugs(
      [item('a', 'basic'), item('b', 'basic'), item('c', 'basic')],
      new Set(['b']),
      1,
    )

    expect(slugsOf(result.map(listing => ({ listing })))).toEqual(['a'])
  })

  test('returns nothing for a non-positive limit', () => {
    expect(takeListingsWithoutSlugs([item('a', 'basic')], new Set(), 0)).toEqual([])
  })
})
