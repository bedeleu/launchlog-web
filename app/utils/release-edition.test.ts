import { describe, expect, test } from 'bun:test'
import { releaseEdition } from './release-edition'

describe('releaseEdition', () => {
  test('prints the listing date as a stable ISO calendar date', () => {
    expect(releaseEdition('2026-08-01T00:00:00Z')).toBe('2026-08-01')
    expect(releaseEdition('2026-08-01T12:34:56.789000Z')).toBe('2026-08-01')
  })

  test('normalises to UTC so SSR and the client cannot disagree', () => {
    // 23:30 in UTC+3 is still the same UTC day; the marker must not drift with
    // the renderer's timezone the way a locale-formatted date would.
    expect(releaseEdition('2026-08-01T23:30:00+03:00')).toBe('2026-08-01')
  })

  test('returns nothing for an unlisted release so the marker is omitted', () => {
    expect(releaseEdition(null)).toBe('')
    expect(releaseEdition(undefined)).toBe('')
    expect(releaseEdition('')).toBe('')
  })

  test('returns nothing rather than printing an invalid date', () => {
    expect(releaseEdition('not-a-date')).toBe('')
  })
})
