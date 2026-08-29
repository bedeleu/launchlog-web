import { describe, expect, test } from 'bun:test'
import { stripRedditClickId } from './privacy-query'

describe('Reddit click ID handling', () => {
  test('drops the click identifier while preserving application and UTM fields', () => {
    const result = stripRedditClickId({
      rdt_cid: 'private-click-id',
      utm_source: 'reddit',
      utm_medium: 'paid_social',
      plan: 'featured',
    })

    expect(result).toEqual({
      changed: true,
      query: {
        utm_source: 'reddit',
        utm_medium: 'paid_social',
        plan: 'featured',
      },
    })
    expect(JSON.stringify(result)).not.toContain('private-click-id')
  })

  test('removes case variants and array values without retaining them', () => {
    expect(stripRedditClickId({ RDT_CID: ['one', 'two'], safe: 'value' })).toEqual({
      changed: true,
      query: { safe: 'value' },
    })
  })

  test('returns the same safe values when no click ID exists', () => {
    expect(stripRedditClickId({ utm_source: 'reddit', plan: null })).toEqual({
      changed: false,
      query: { utm_source: 'reddit', plan: null },
    })
  })
})
