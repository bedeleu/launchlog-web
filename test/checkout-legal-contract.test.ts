import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const page = read('../app/pages/preview/[token].vue')
const component = read('../app/components/Intake/CheckoutLegalConsent.vue')
const billing = read('../app/composables/useBilling.ts')

describe('checkout legal contract', () => {
  test('keeps the two legal decisions separate, explicit and unselected', () => {
    expect(component.match(/type="checkbox"/g)).toHaveLength(2)
    expect(component).not.toMatch(/\schecked(?:\s|>|=)/)
    expect(component).toContain('acceptanceText')
    expect(component).toContain('performanceRequestText')
    expect(component).toContain('termsUrl')
    expect(component).toContain('termsDocument')
    expect(component).toContain('exact accepted snapshot')
    expect(component).toContain('v-if="termsAccepted"')
    expect(component).toContain('v-if="immediatePerformanceRequested"')
    expect(component).not.toContain('I expressly request that publication begin')
  })

  test('focuses the first invalid legal decision and lets buyers discard stale saved checkout', () => {
    expect(page).toContain('focusCheckoutBlocker')
    expect(page).toContain("'checkout-terms-accepted'")
    expect(page).toContain("'checkout-immediate-performance'")
    expect(page).toContain("'checkout-legal-config-alert'")
    expect(page).toContain('Cancel saved checkout and restart')
    expect(page).toContain("errorCode === 'checkout_agreement_changed'")
  })

  test('blocks checkout until both decisions and formal order facts are present', () => {
    expect(page).toContain('termsAccepted.value')
    expect(page).toContain('immediatePerformanceRequested.value')
    expect(page).toContain('checkoutLegalReady.value')
    expect(page).toContain('CheckoutLegalConsent')
    expect(page).toContain('Contracting provider')
    expect(page).toContain('Annual renewal')
    expect(page).toContain('Continue to secure payment')
  })

  test('lets a transient capability failure recover without a hard reload', () => {
    expect(page).toContain('status: checkoutCapabilityStatus')
    expect(page).toContain('retryCheckoutCapability')
    expect(page).toContain('await refreshCheckoutCapability()')
    expect(page).toContain('Retry checkout information')
    expect(page).toContain("checkoutCapabilityStatus === 'pending'")
  })

  test('marks translated contract copy and keeps the scrollable snapshot keyboard accessible', () => {
    expect(component).toContain(':lang="locale"')
    expect(component).toContain('tabindex="0"')
    expect(component).toContain('Exact accepted Terms snapshot')
    expect(component).toContain('Copia exactă a Termenilor acceptați')
    expect(component).toContain('Acceptă Termenii pentru a continua.')
    expect(page).toContain(':lang="legalLocale"')
  })

  test('sends the selected server capability fingerprints but never a browser-authored timestamp or legal text', () => {
    for (const field of [
      'terms_accepted',
      'terms_version',
      'immediate_performance_requested',
      'performance_notice_version',
      'legal_locale',
      'checkout_capability_version',
      'checkout_capability_sha256',
      'provider_sha256',
      'offer_catalog_sha256',
      'terms_document_sha256',
    ]) {
      expect(billing).toContain(field)
    }

    expect(billing).not.toContain('accepted_at')
    expect(billing).not.toContain('acceptance_text')
    expect(page).toContain('getCheckoutCapability')
    expect(page).toContain('checkoutCapability')
    expect(page).not.toContain('CHECKOUT_TERMS_VERSION')
  })
})
