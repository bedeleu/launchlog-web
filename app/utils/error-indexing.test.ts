import { describe, expect, test } from 'bun:test'
import { shouldDeindexErrorStatus } from './error-indexing'

describe('shouldDeindexErrorStatus', () => {
  test('deindexes permanently excluded statuses', () => {
    for (const status of [401, 403, 404, 410]) {
      expect(shouldDeindexErrorStatus(status)).toBe(true)
    }
  })

  // A deindex directive on a temporary failure asks search engines to drop live URLs.
  test('never deindexes a temporary client error', () => {
    for (const status of [408, 425, 429]) {
      expect(shouldDeindexErrorStatus(status)).toBe(false)
    }
  })

  test('never deindexes a server error', () => {
    for (const status of [500, 502, 503, 504]) {
      expect(shouldDeindexErrorStatus(status)).toBe(false)
    }
  })

  test('does not deindex statuses outside the explicit permanent set', () => {
    for (const status of [200, 301, 302, 304, 400, 405, 418, 451]) {
      expect(shouldDeindexErrorStatus(status)).toBe(false)
    }
  })
})
