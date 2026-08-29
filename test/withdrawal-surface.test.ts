import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const form = read('../app/components/Legal/WithdrawalForm.vue')
const english = read('../app/pages/withdrawal.vue')
const romanian = read('../app/pages/ro/retragere.vue')
const footer = read('../app/components/Footer.vue')
const config = read('../nuxt.config.ts')

describe('permanent online withdrawal function', () => {
  test('has a review step and an unambiguous final confirmation without demanding a reason', () => {
    expect(form).toContain("stage === 'review'")
    expect(form).toContain('Confirm withdrawal')
    expect(form).toContain('Declaration recipient')
    expect(form).toContain('recipientReady')
    expect(form).toContain('this form remains blocked')
    expect(form).toContain('I hereby notify')
    expect(form).toContain('Confirmation requested for')
    expect(form).toContain('required maxlength="120"')
    expect(form).toContain('required maxlength="500"')
    expect(form).toContain('required maxlength="254"')
    expect(form).toContain('Confirmați retragerea')
    expect(form).toContain('contract_details')
    expect(form).toContain('confirmation_email')
    expect(form).not.toMatch(/required[^\n]*reason|reason[^\n]*required/i)
  })

  test('publishes accessible English and Romanian routes with reverse language links', () => {
    expect(english).toContain("const pageUrl = `${siteUrl}/withdrawal`")
    expect(english).toContain('/ro/retragere')
    expect(romanian).toContain("const pageUrl = `${siteUrl}/ro/retragere`")
    expect(romanian).toContain('/withdrawal')
    expect(english).toContain(':legal-name="config.public.legalName"')
    expect(english).toContain(':legal-address="config.public.legalAddress"')
    expect(english).toContain(':legal-email="config.public.legalEmail"')
    expect(romanian).toContain(':legal-registration-id="config.public.legalRegistrationId"')
    expect(romanian).toContain("htmlAttrs: { lang: 'ro' }")
  })

  test('keeps the function permanently reachable but out of the discovery sitemap', () => {
    expect(footer).toContain("{ label: 'Withdraw from contract here', to: '/withdrawal' }")
    expect(config).toContain("'/withdrawal'")
    expect(config).toContain("'/ro/retragere'")
  })
})
