import { describe, expect, test } from 'bun:test'
import type { Listing } from '../../app/composables/useListings'
import { fetchListingProof, ListingProofError } from './listing-proof'

const VALID_LISTING: Listing = {
  slug: 'tool',
  name: 'Tool',
  tagline: 'Ship it',
  description: 'A tool.',
  link_text: null,
  url: 'https://tool.example',
  screenshot_url: null,
  tier: 'basic',
  source: 'customer',
  category: null,
  tags: [],
  tech_stack: [],
  has_llms_txt: true,
  has_schema_org: true,
  has_markdown_negotiation: true,
  country: null,
  pricing: { low: 0, high: 0, currency: 'USD' },
  published_at: '2026-08-01T00:00:00Z',
  enriched_at: null,
}

describe('listing proof status', () => {
  test('returns the current public listing and domain shape on valid injected success', async () => {
    const listing = { ...VALID_LISTING }
    const fetcher = async () => ({ data: listing })

    const result = await fetchListingProof('tool', 'https://api.example', fetcher)

    expect(result).toEqual({ listing, domain: expect.any(String) })
    expect(Object.keys(result)).toEqual(['listing', 'domain'])
  })

  test.each([
    [404, 404],
    [410, 410],
    [500, 503],
  ] as const)('normalizes upstream %i to %i', async (upstream, expected) => {
    const fetcher = async () => {
      throw Object.assign(new Error('private upstream body'), { statusCode: upstream })
    }

    await expect(fetchListingProof('tool', 'https://api.example', fetcher)).rejects
      .toEqual(new ListingProofError(expected))
  })

  test('rejects malformed success as 503', async () => {
    await expect(fetchListingProof('tool', 'https://api.example', async () => ({ data: null })))
      .rejects.toEqual(new ListingProofError(503))
  })

  test('rejects a truthy malformed listing as 503', async () => {
    await expect(fetchListingProof('tool', 'https://api.example', async () => ({ data: {} })))
      .rejects.toEqual(new ListingProofError(503))
  })

  test('accepts nullable Markdown and schema fields without mutating the listing', async () => {
    const listing = {
      ...VALID_LISTING,
      tagline: null,
      description: null,
      screenshot_url: null,
      category: null,
      pricing: null,
      published_at: null,
    }

    const result = await fetchListingProof('tool', 'https://api.example', async () => ({ data: listing }))

    expect(Object.is(result.listing, listing)).toBeTrue()
  })

  test('accepts the API high-only pricing shape without mutating the listing', async () => {
    const listing = {
      ...VALID_LISTING,
      pricing: { low: null, high: 99, currency: 'USD' },
    }

    const result = await fetchListingProof('tool', 'https://api.example', async () => ({ data: listing }))

    expect(Object.is(result.listing, listing)).toBeTrue()
  })

  test.each([
    ['a mismatched slug', { slug: 'different-tool' }],
    ['an unsafe website URL', { url: 'https://user:pass@tool.example' }],
    ['an invalid publication date', { published_at: 'not-a-date' }],
    ['a non-string nullable tagline', { tagline: 42 }],
    ['a non-string nullable description', { description: {} }],
    ['a malformed technology array', { tech_stack: ['Nuxt', 42] }],
    ['a malformed tag object', { tags: [{ slug: 'shipping' }] }],
    ['a malformed category object', { category: { slug: 'developer-tools' } }],
    ['an unsafe screenshot URL', { screenshot_url: 'http://cdn.example/tool.png' }],
    ['a non-finite pricing low', { pricing: { low: Number.POSITIVE_INFINITY, currency: 'USD' } }],
    ['a non-finite pricing high', { pricing: { low: null, high: Number.POSITIVE_INFINITY, currency: 'USD' } }],
    ['an empty pricing currency', { pricing: { low: 0, currency: '   ' } }],
  ] as const)('rejects %s as 503', async (_label, patch) => {
    const listing = { ...VALID_LISTING, ...patch }

    await expect(fetchListingProof('tool', 'https://api.example', async () => ({ data: listing })))
      .rejects.toEqual(new ListingProofError(503))
  })
})
