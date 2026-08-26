import { describe, expect, test } from 'bun:test'
import { parseCanonicalPageParam } from './pagination'

describe('canonical page query parser', () => {
  test('accepts an absent query and canonical positive integers', () => {
    expect(parseCanonicalPageParam(undefined)).toBe(1)
    expect(parseCanonicalPageParam('1')).toBe(1)
    expect(parseCanonicalPageParam('27')).toBe(27)
  })

  test('rejects duplicate aliases and unbounded values', () => {
    for (const value of ['0', '-1', '01', '1.0', ' 2', ['1', '2'], '9'.repeat(40)]) {
      expect(parseCanonicalPageParam(value)).toBeNull()
    }
  })
})
