import { describe, expect, mock, test } from 'bun:test'
import type { Listing } from '../../app/composables/useListings'
import * as listingHttpStatus from '../../shared/utils/listing-http-status'

mock.module('#shared/utils/listing-http-status', () => listingHttpStatus)

interface ListingProofModule {
  fetchListingProof(
    slug: string,
    apiUrl: string,
    fetcher: (input: string) => Promise<{ data?: Listing | null }>,
  ): Promise<{ listing: Listing, domain: string }>
  ListingProofError: new (statusCode: number) => Error
}

const { fetchListingProof, ListingProofError } = await import('./' + 'listing-proof') as unknown as ListingProofModule

describe('listing proof status', () => {
  test('returns the current public listing and domain shape on valid injected success', async () => {
    const listing: Listing = {
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
    const fetcher = async () => ({ data: listing })

    const result = await fetchListingProof('tool', 'https://api.example', fetcher)

    expect(result).toEqual({ listing, domain: expect.any(String) })
    expect(Object.keys(result)).toEqual(['listing', 'domain'])
  })

  test.each([
    [404, 404],
    [410, 410],
    [500, 503],
  ])('normalizes upstream %i to %i', async (upstream, expected) => {
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
})
