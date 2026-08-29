import { describe, expect, test } from 'bun:test'
import { parseCheckoutCapability } from './checkout-capability'

const HASH = 'a'.repeat(64)

const fixture = () => ({
  schema_version: '1',
  capability_version: '2026-08-29.1',
  capability_sha256: HASH,
  checkout_enabled: true,
  provider: {
    legal_name: 'Registered provider',
    legal_address: 'Registered address, Timișoara 300369, Romania',
    registration_id: 'J35/0000/2026',
    tax_id: '12345678',
    phone: '+40 000 000 000',
    email: 'legal@example.com',
  },
  provider_sha256: 'b'.repeat(64),
  offers: Object.fromEntries(['basic', 'featured'].map((tier, index) => [tier, {
    tier,
    name: index === 0 ? 'Standard' : 'Featured',
    amount_minor: index === 0 ? 2499 : 9900,
    currency: 'USD',
    interval: 'year',
    interval_count: 1,
    quantity: 1,
    stripe_price_id: `price_${tier}`,
    stripe_price_tax_behavior: 'exclusive',
    automatic_tax_enabled: false,
    notices: {
      en: { tax: 'English tax.', renewal: 'English renewal.', cancellation: 'English cancellation.', voluntary_refund: 'English refund.' },
      ro: { tax: 'Taxă română.', renewal: 'Reînnoire română.', cancellation: 'Anulare română.', voluntary_refund: 'Rambursare română.' },
    },
  }])),
  offer_catalog_sha256: 'c'.repeat(64),
  legal: {
    terms_version: '2026-08-29',
    performance_notice_version: '2026-08-29',
    locales: {
      en: {
        url: 'https://launchlog.ai/terms',
        document: 'English canonical Terms.',
        document_sha256: 'd'.repeat(64),
        acceptance_text: 'I accept the exact English Terms.',
        performance_request_text: 'I request immediate English performance.',
      },
      ro: {
        url: 'https://launchlog.ai/ro/terms',
        document: 'Termenii canonici în română.',
        document_sha256: 'e'.repeat(64),
        acceptance_text: 'Accept Termenii exacți în română.',
        performance_request_text: 'Solicit executarea imediată în română.',
      },
    },
  },
})

describe('parseCheckoutCapability', () => {
  test('accepts the complete server-authoritative bilingual checkout snapshot', () => {
    const parsed = parseCheckoutCapability(fixture(), 'launchlog.ai')

    expect(parsed.checkout_enabled).toBe(true)
    expect(parsed.offers.featured.amount_minor).toBe(9900)
    expect(parsed.legal.locales.ro.acceptance_text).toBe('Accept Termenii exacți în română.')
  })

  test('fails closed for malformed fingerprints, incomplete notices or unsupported commercial facts', () => {
    for (const mutate of [
      (value: ReturnType<typeof fixture>) => { value.capability_sha256 = 'not-a-hash' },
      (value: ReturnType<typeof fixture>) => { value.offers.basic!.notices.ro.cancellation = '' },
      (value: ReturnType<typeof fixture>) => { value.offers.basic!.currency = 'EUR' },
      (value: ReturnType<typeof fixture>) => { value.offers.basic!.quantity = 2 },
      (value: ReturnType<typeof fixture>) => { value.legal.locales.ro.document_sha256 = value.legal.locales.en.document_sha256 },
    ]) {
      const value = fixture()
      mutate(value)
      expect(() => parseCheckoutCapability(value, 'launchlog.ai')).toThrow('invalid checkout capability')
    }
  })

  test('rejects Terms links that can leave the canonical LaunchLog origin', () => {
    for (const url of [
      'https://launchlog.ai.evil.example/terms',
      'https://user@launchlog.ai/terms',
      'https://launchlog.ai:444/terms',
      'https://launchlog.ai/terms?continue=evil',
      'http://launchlog.ai/terms',
      'https://launchlog.ai/not-terms',
    ]) {
      const value = fixture()
      value.legal.locales.en.url = url
      expect(() => parseCheckoutCapability(value, 'launchlog.ai')).toThrow('invalid checkout capability')
    }
  })
})
