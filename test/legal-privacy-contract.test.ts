import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const privacy = read('../app/pages/privacy.vue')
const cookies = read('../app/pages/cookies.vue')
const terms = read('../app/pages/terms.vue')
const contact = read('../app/pages/contact.vue')
const config = read('../nuxt.config.ts')
const envExample = read('../.env.example')

describe('production legal and privacy contract', () => {
  test('separates the public brand from the formal contracting provider', () => {
    expect(config).toContain('operatorBrand:')
    for (const field of ['legalAddress:', 'legalRegistrationId:', 'legalTaxId:', 'legalPhone:']) {
      expect(config).toContain(field)
    }
    expect(terms).toContain('AB Solutions')
    expect(terms).toContain('contracting service provider')
    expect(contact).toContain('legalAddress')
    expect(contact).toContain('legalRegistrationId')
    expect(contact).toContain('legalTaxId')
    expect(terms).toContain("String(config.public.legalTaxId ?? '').trim()")
  })

  test('keeps the staged formal identity and official postal-directory address aligned', () => {
    expect(envExample).toContain('NUXT_PUBLIC_LEGAL_NAME="AB SOLUTIONS S.R.L."')
    expect(envExample).toContain('NUXT_PUBLIC_LEGAL_ADDRESS="Str. Grigore Alexandrescu nr. 174')
    expect(envExample).toContain('300369 Timișoara')
    expect(envExample).toContain('NUXT_PUBLIC_LEGAL_REGISTRATION_ID=J35/1784/2023')
    expect(envExample).toContain('NUXT_PUBLIC_LEGAL_TAX_ID=48116710')
    expect(envExample).not.toContain('300351')
    expect(envExample).not.toContain('BEDELEU ALEXANDRU PFA')
  })

  test('describes analytics processing accurately and never repeats the old absolute claim', () => {
    expect(privacy).not.toContain('stores no personal data')
    expect(privacy).not.toContain('load optional Plausible analytics')
    expect(privacy).not.toContain('loads its self-hosted Plausible script')
    expect(privacy).toContain('Plausible transiently processes the IP address and user-agent')
    expect(privacy).toContain('rotating daily pseudonymous visitor identifier')
    expect(privacy).toContain('browser, operating-system, device and country/region/city dimensions')
    expect(privacy).toContain('explicit analytics choice')
    expect(privacy).toContain('Plausible Events API')
    expect(privacy).toContain('No Plausible vendor script or vendor-provided automatic analytics listener runs in the browser')
    expect(privacy).toContain('does not automatically delete aggregate events recorded before withdrawal')
    for (const event of [
      'Preview Created',
      'Checkout Started',
      'Payment Canceled',
      'Listing Published',
    ]) {
      expect(privacy).toContain(event)
    }
    expect(privacy).toContain('private preview URLs, tokens, Stripe Session IDs and Reddit click IDs')
    expect(privacy).toContain('We do not sell or share personal data for cross-context behavioural advertising')
  })

  test('covers current providers, legal bases, rights and the Romanian authority', () => {
    for (const provider of [
      'Firebase Authentication',
      'Stripe',
      'Railway',
      'Cloudflare',
      'Microlink',
      'Google Gemini',
      'Resend',
      'Sentry',
      'Plausible',
    ]) {
      expect(privacy).toContain(provider)
    }
    for (const right of ['access', 'rectification', 'erasure', 'restriction', 'portability', 'object']) {
      expect(privacy.toLowerCase()).toContain(right)
    }
    expect(privacy).toContain('one month')
    expect(privacy).toContain('ANSPDCP')
    expect(privacy).toContain('after at most 7 days')
  })

  test('documents exact browser-storage purposes and consent withdrawal', () => {
    for (const key of [
      'launchlog:privacy-consent:v1',
      'launchlog:magic-link-email',
      'launchlog:magic-link-email-expires-at',
      'launchlog:intake:last-url',
      'launchlog:intake:last-url-expires-at',
      'launchlog:intake:latest-token',
      'launchlog:intake:drafts',
      'launchlog:intake:url-index',
      'launchlog:intake:preferred-tier',
      'launchlog:checkout-return:',
    ]) {
      expect(cookies).toContain(key)
    }
    expect(cookies).not.toContain('requires no consent banner')
    expect(cookies).toContain('Privacy choices')
    expect(cookies).toContain('withdraw')
    expect(cookies).toContain('No Reddit Pixel')
    expect(cookies).toContain('direct request to the self-hosted Plausible Events API')
    expect(cookies).toContain('No Plausible vendor script')
    expect(cookies).toContain('no longer accepted after one hour')
    expect(cookies).toContain('no longer accepted after seven days')
    expect(cookies).toContain('until the recorded preview expiry')
    expect(cookies).toContain('until it is applied to a preview')
    expect(cookies).toContain('does not automatically erase aggregate events already recorded')
    expect(cookies).toContain('expired after six months')
  })

  test('does not let the voluntary refund promise narrow mandatory consumer rights', () => {
    expect(terms).toContain('14-day statutory right of withdrawal')
    expect(terms).toContain('express request for immediate performance')
    expect(terms).toContain('7-day money-back guarantee is additional')
    expect(terms).toContain('Romanian law')
    expect(terms).toContain('competent courts of Timișoara')
    expect(terms).toContain('mandatory consumer protections')
    expect(terms).toContain('legal conformity rights for digital services')
    expect(terms).toContain('For business users')
    expect(terms).toContain('For consumers, liability and remedies are governed by mandatory law')
    expect(terms).not.toContain('Approved refunds')
  })
})
