import { describe, expect, test } from 'bun:test'
import { assertProductionAnalytics } from './analytics-readiness'

const valid = {
  enabled: true,
  domain: 'launchlog.ai',
  endpoint: 'https://plausible.launchlog.ai/api/event',
  siteDomain: 'launchlog.ai',
}

describe('production analytics readiness', () => {
  test('requires the complete safe Events API tuple on every production provider', () => {
    expect(() => assertProductionAnalytics(
      { NUXT_DEPLOY_ENVIRONMENT: 'production' },
      { ...valid, enabled: undefined },
    )).toThrow('set NUXT_PUBLIC_PLAUSIBLE_ENABLED explicitly')

    expect(() => assertProductionAnalytics(
      { RAILWAY_ENVIRONMENT_NAME: 'production' },
      { ...valid, endpoint: 'https://plausible.io/api/event' },
    )).toThrow('NUXT_PUBLIC_PLAUSIBLE_ENDPOINT')

    expect(() => assertProductionAnalytics(
      { VERCEL_ENV: 'production' },
      valid,
    )).not.toThrow()
  })

  test('does not require production analytics during local or CI artifact checks', () => {
    expect(() => assertProductionAnalytics({}, {
      enabled: false,
      domain: '',
      endpoint: '',
    })).not.toThrow()
  })

  test('preserves an explicit production privacy kill switch', () => {
    expect(() => assertProductionAnalytics(
      { NUXT_DEPLOY_ENVIRONMENT: 'production' },
      { enabled: 'false', domain: '', endpoint: '' },
    )).not.toThrow()
  })

  test('blocks production analytics from writing a staging origin into the production dataset', () => {
    expect(() => assertProductionAnalytics(
      { VERCEL_ENV: 'production' },
      { ...valid, siteDomain: 'staging.launchlog.ai' },
    )).toThrow('NUXT_PUBLIC_PLAUSIBLE_DOMAIN must exactly match NUXT_PUBLIC_DOMAIN')
  })
})
