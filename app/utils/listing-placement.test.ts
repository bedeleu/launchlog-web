import { describe, expect, test } from 'bun:test'
import type { ListingTier } from '../composables/useListings'
import {
  packHomepageFeatured,
  packMixedTierPage,
  packUniform,
  takeListingsWithoutSlugs,
} from './listing-placement'

const item = (slug: string, tier: ListingTier) => ({ slug, tier })
const shape = <T extends { slug: string }>(packed: { listing: T, variant: string, span: string }[]) =>
  packed.map(p => `${p.listing.slug}:${p.variant}:${p.span}`)

describe('packMixedTierPage', () => {
  test('assigns the approved one-row footprint to each tier', () => {
    const packed = packMixedTierPage([
      item('f1', 'featured'),
      item('p1', 'premium'),
      item('p2', 'premium'),
      item('b1', 'basic'),
      item('b2', 'basic'),
      item('b3', 'basic'),
    ])

    expect(shape(packed)).toEqual([
      'f1:directory-spotlight:full-short',
      'p1:wide:double',
      'b1:standard:unit',
      'p2:wide:double',
      'b2:standard:unit',
      'b3:standard:unit',
    ])
  })

  test('gives each premium exactly one real basic companion', () => {
    const packed = packMixedTierPage([
      item('p1', 'premium'),
      item('p2', 'premium'),
      item('b1', 'basic'),
      item('b2', 'basic'),
      item('b3', 'basic'),
      item('b4', 'basic'),
    ])

    expect(shape(packed)).toEqual([
      'p1:wide:double',
      'b1:standard:unit',
      'p2:wide:double',
      'b2:standard:unit',
      'b3:standard:unit',
      'b4:standard:unit',
    ])
  })

  test('keeps premium two columns wide when no real companion is left', () => {
    // The API fills a page's premium rows with real basics whenever the filtered
    // cohort has them. When it genuinely cannot, the third column stays empty:
    // widening the card would advertise a placement the buyer did not purchase.
    expect(shape(packMixedTierPage([item('p1', 'premium')]))).toEqual([
      'p1:wide:double',
    ])

    expect(shape(packMixedTierPage([item('p1', 'premium'), item('p2', 'premium'), item('b1', 'basic')]))).toEqual([
      'p1:wide:double',
      'b1:standard:unit',
      'p2:wide:double',
    ])
  })

  test('companion slugs never appear again in the trailing collection', () => {
    const packed = packMixedTierPage([
      item('p1', 'premium'),
      item('b1', 'basic'),
      item('b2', 'basic'),
      item('b3', 'basic'),
    ])
    const slugs = packed.map(p => p.listing.slug)

    expect(new Set(slugs).size).toBe(slugs.length)
  })

  test('never emits a row span on a mixed directory card', () => {
    const packed = packMixedTierPage([
      item('f1', 'featured'),
      item('p1', 'premium'),
      item('b1', 'basic'),
      item('b2', 'basic'),
    ])

    expect(packed.map(p => p.span)).not.toContain('half-tall')
    expect(packed.every(p => p.span === 'unit' || p.span === 'double' || p.span === 'full-short')).toBe(true)
  })

  test('spends exactly thirty slots on the production-shaped page', () => {
    const weight = { 'unit': 1, 'double': 2, 'full-short': 3, 'half-tall': 6 } as const
    const page = [
      ...Array.from({ length: 2 }, (_, n) => item(`f${n}`, 'featured' as const)),
      item('p1', 'premium'),
      ...Array.from({ length: 22 }, (_, n) => item(`b${n}`, 'basic' as const)),
    ]

    const packed = packMixedTierPage(page)

    expect(packed).toHaveLength(25)
    expect(packed.reduce((sum, p) => sum + weight[p.span], 0)).toBe(30)
  })

  test('preserves API order inside each tier', () => {
    const packed = packMixedTierPage([
      item('b1', 'basic'),
      item('f2', 'featured'),
      item('b2', 'basic'),
      item('f1', 'featured'),
      item('b3', 'basic'),
    ])

    expect(packed.map(p => p.listing.slug)).toEqual(['f2', 'f1', 'b1', 'b2', 'b3'])
  })

  test('never duplicates, synthesizes or drops an input listing', () => {
    const input = [
      item('f1', 'featured'),
      item('p1', 'premium'),
      item('p2', 'premium'),
      item('b1', 'basic'),
      item('b2', 'basic'),
      item('b3', 'basic'),
    ]
    const out = packMixedTierPage(input).map(p => p.listing.slug).sort()

    expect(out).toEqual(input.map(i => i.slug).sort())
  })

  test('handles empty and single-item cohorts safely', () => {
    expect(packMixedTierPage([])).toEqual([])
    expect(shape(packMixedTierPage([item('b1', 'basic')]))).toEqual(['b1:standard:unit'])
    expect(shape(packMixedTierPage([item('f1', 'featured')]))).toEqual(['f1:directory-spotlight:full-short'])
  })

  test('does not mutate the input array or its element order', () => {
    const input = [
      item('f1', 'featured'),
      item('p1', 'premium'),
      item('b1', 'basic'),
      item('b2', 'basic'),
      item('b3', 'basic'),
    ]
    const snapshot = [...input]

    packMixedTierPage(input)

    expect(input).toEqual(snapshot)
    expect(input.map(i => i.slug)).toEqual(snapshot.map(i => i.slug))
  })
})

describe('packUniform', () => {
  test('never applies bento packing and differs from the page-one mixed layout', () => {
    const input = [item('f1', 'featured'), item('p1', 'premium'), item('b1', 'basic')]

    expect(shape(packUniform(input))).toEqual([
      'f1:standard:unit',
      'p1:standard:unit',
      'b1:standard:unit',
    ])
    expect(shape(packUniform(input))).not.toEqual(shape(packMixedTierPage(input)))
  })

  test('handles an empty cohort', () => {
    expect(packUniform([])).toEqual([])
  })
})

describe('packHomepageFeatured', () => {
  test('elevates the first slot and keeps the rest standard', () => {
    expect(shape(packHomepageFeatured([
      item('f1', 'featured'),
      item('f2', 'featured'),
      item('f3', 'featured'),
    ]))).toEqual([
      'f1:spotlight:half-tall',
      'f2:standard:unit',
      'f3:standard:unit',
    ])
  })

  test('degrades cleanly for one item and for none', () => {
    expect(shape(packHomepageFeatured([item('f1', 'featured')]))).toEqual(['f1:spotlight:full-short'])
    expect(packHomepageFeatured([])).toEqual([])
  })
})

describe('takeListingsWithoutSlugs', () => {
  test('fills the limit after removing already-shown slugs', () => {
    const recent = ['f-a', 'b-a', 'f-b', 'b-b', 'b-c', 'b-d', 'b-e', 'b-f']
      .map(slug => ({ slug }))

    expect(takeListingsWithoutSlugs(recent, new Set(['f-a', 'f-b']), 6).map(l => l.slug))
      .toEqual(['b-a', 'b-b', 'b-c', 'b-d', 'b-e', 'b-f'])
  })

  test('returns nothing for a non-positive limit', () => {
    expect(takeListingsWithoutSlugs([{ slug: 'a' }], new Set<string>(), 0)).toEqual([])
  })
})
