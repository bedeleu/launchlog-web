import { describe, expect, test } from 'bun:test'
import { normalizeDiscoveryError } from './discovery-error-cache'

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
