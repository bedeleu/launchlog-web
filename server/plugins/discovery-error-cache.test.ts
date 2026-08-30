import { describe, expect, test } from 'bun:test'

interface DiscoveryErrorCacheModule {
  normalizeDiscoveryError(error: unknown): { statusCode: number }
}

const { normalizeDiscoveryError } = await import('./' + 'discovery-error-cache') as DiscoveryErrorCacheModule

describe('discovery error cache contract', () => {
  test.each([
    [404, 404],
    [410, 410],
    [500, 503],
    [502, 503],
  ])('normalizes %i to a retry-safe %i response', (upstream, expected) => {
    expect(normalizeDiscoveryError({ statusCode: upstream })).toEqual({ statusCode: expected })
  })

  test('never exposes upstream error details', () => {
    expect(normalizeDiscoveryError({ statusCode: 500, message: 'private upstream body' }))
      .toEqual({ statusCode: 503 })
  })
})
