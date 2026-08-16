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
  test('assigns the approved variant and span to each tier', () => {
    const packed = packMixedTierPage([
      item('f1', 'featured'),
      item('p1', 'premium'),
      item('b1', 'basic'),
      item('b2', 'basic'),
    ])

    expect(shape(packed)).toEqual([
      'f1:spotlight:full-tall',
      'p1:wide:half-tall',
      'b1:standard:unit',
      'b2:standard:unit',
    ])
  })

  test('pairs each premium with exactly two real basic companions', () => {
    const packed = packMixedTierPage([
      item('p1', 'premium'),
      item('p2', 'premium'),
      item('b1', 'basic'),
      item('b2', 'basic'),
      item('b3', 'basic'),
      item('b4', 'basic'),
      item('b5', 'basic'),
    ])

    expect(shape(packed)).toEqual([
      'p1:wide:half-tall',
      'b1:standard:unit',
      'b2:standard:unit',
      'p2:wide:half-tall',
      'b3:standard:unit',
      'b4:standard:unit',
      'b5:standard:unit',
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

  test('uses the no-hole full-width fallback when fewer than two basics remain', () => {
    expect(shape(packMixedTierPage([item('p1', 'premium'), item('b1', 'basic')]))).toEqual([
      'p1:wide:full-short',
      'b1:standard:unit',
    ])

    expect(shape(packMixedTierPage([item('p1', 'premium')]))).toEqual([
      'p1:wide:full-short',
    ])
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
    expect(shape(packMixedTierPage([item('f1', 'featured')]))).toEqual(['f1:spotlight:full-tall'])
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
