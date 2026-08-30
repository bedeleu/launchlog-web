import { describe, expect, test } from 'bun:test'
import { fetchListingProof, ListingProofError } from './listing-proof'

describe('listing proof status', () => {
  test('returns the current public listing and domain shape on valid injected success', async () => {
    const listing = { slug: 'tool', name: 'Tool' }
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
