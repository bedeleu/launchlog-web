import { describe, expect, test } from 'bun:test'
import { PUBLIC_PLANS } from './public-plans'
import { SITE_IDENTITY } from './site-identity'

describe('public facts', () => {
  test('matches the D-065 two-plan model without retired pricing', () => {
    expect(PUBLIC_PLANS.map(plan => ({
      tier: plan.tier,
      name: plan.name,
      annualPriceCents: plan.annualPriceCents,
    }))).toEqual([
      { tier: 'basic', name: 'Standard', annualPriceCents: 2499 },
      { tier: 'featured', name: 'Featured', annualPriceCents: 9900 },
    ])
  })

  test('keeps the public entity graph on verified first-party profiles', () => {
    expect(SITE_IDENTITY.publicEmail).toBe('hello@launchlog.ai')
    expect(SITE_IDENTITY.logoPath).toBe('/images/samples/logo.jpg')
    expect(new Set(SITE_IDENTITY.socialProfiles).size).toBe(SITE_IDENTITY.socialProfiles.length)
    expect(SITE_IDENTITY.socialProfiles.every(url => url.startsWith('https://'))).toBe(true)
  })

  test('uses the public AB Solutions operator identity', () => {
    expect(SITE_IDENTITY.operatorName).toBe('AB Solutions')
  })
})
