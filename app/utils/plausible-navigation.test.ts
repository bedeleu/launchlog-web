import { describe, expect, test } from 'bun:test'
import { shouldTrackPlausibleNavigation } from './plausible-navigation'

const capability = {
  origin: 'https://launchlog.ai',
  endpoint: 'https://plausible.launchlog.ai/api/event',
}

describe('Plausible navigation boundary', () => {
  test('tracks successful navigation only', () => {
    expect(shouldTrackPlausibleNavigation('/pricing', '/', undefined, capability)).toBe(true)
    expect(shouldTrackPlausibleNavigation('/terms', '/pricing', null, capability)).toBe(true)
  })

  test('does not count aborted, cancelled or duplicated navigation failures', () => {
    for (const type of [4, 8, 16]) {
      expect(shouldTrackPlausibleNavigation('/pricing', '/', { type }, capability)).toBe(false)
    }
  })

  test('does not double-count same-document anchors or query changes removed by the sanitizer', () => {
    expect(shouldTrackPlausibleNavigation('/privacy#rights', '/privacy', undefined, capability)).toBe(false)
    expect(shouldTrackPlausibleNavigation('/terms?private=value', '/terms', undefined, capability)).toBe(false)
  })

  test('tracks a deterministic attribution change only when the analytics URL changes', () => {
    const campaign = '/submit?utm_source=reddit&utm_medium=paid_social&utm_campaign=reddit_founder_listing_test_01&utm_content=preview_before_pay&utm_term=community_founders'
    expect(shouldTrackPlausibleNavigation(campaign, '/submit', undefined, capability)).toBe(true)
  })
})
