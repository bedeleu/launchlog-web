import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const privacy = read('../app/pages/ro/privacy.vue')
const cookies = read('../app/pages/ro/cookies.vue')
const terms = read('../app/pages/ro/terms.vue')

describe('Romanian legal routes', () => {
  test('publish Romanian canonicals, schema language and English alternates', () => {
    for (const [document, route] of [
      [privacy, 'privacy'],
      [cookies, 'cookies'],
      [terms, 'terms'],
    ] as const) {
      expect(document).toContain(`const pageUrl = \`${'${siteUrl}'}/ro/${route}\``)
      expect(document).toContain("inLanguage: 'ro-RO'")
      expect(document).toContain(`{ rel: 'alternate', hreflang: 'en-US', href: \`${'${siteUrl}'}/${route}\` }`)
      expect(document).toContain('locale="ro"')
      expect(document).toContain(`alternate-path="/${route}"`)
      expect(document).toContain('alternate-label="English"')
    }
  })

  test('keeps controller identity sourced from runtime configuration', () => {
    for (const field of [
      'operatorBrand',
      'legalName',
      'legalAddress',
      'legalRegistrationId',
      'legalTaxId',
      'legalEmail',
    ]) {
      expect(privacy).toContain(`config.public.${field}`)
    }

    for (const field of [
      'operatorBrand',
      'legalName',
      'legalAddress',
      'legalRegistrationId',
      'legalTaxId',
      'legalPhone',
      'legalEmail',
      'supportEmail',
      'taxNoticeRo',
    ]) {
      expect(terms).toContain(`config.public.${field}`)
    }
  })

  test('states analytics, providers, retention and GDPR rights accurately', () => {
    expect(privacy).toContain('API-ul Events Plausible găzduit de noi')
    expect(privacy).toContain('nu rulează niciun script furnizat de Plausible')
    expect(privacy).toContain('nu șterge automat evenimentele agregate')
    expect(privacy).toContain('Nu este activ niciun Reddit Pixel')
    expect(privacy).toContain('după cel mult 7 zile')
    expect(privacy).toContain('după șase luni')

    for (const event of [
      'Preview Created',
      'Checkout Started',
      'Payment Canceled',
      'Listing Published',
    ]) {
      expect(privacy).toContain(event)
    }

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
      'Better Stack',
    ]) {
      expect(privacy).toContain(provider)
    }

    expect(privacy).toContain('o lună')
    expect(privacy).toContain('ANSPDCP')
  })

  test('documents exact storage records and lifetimes in Romanian', () => {
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

    expect(cookies).toContain('Nu mai sunt acceptate după o oră')
    expect(cookies).toContain('Nu mai sunt acceptate după șapte zile')
    expect(cookies).toContain('Nu este activ niciun Reddit Pixel')
    expect(cookies).toContain('nu șterge automat evenimentele agregate')
  })

  test('preserves Romanian consumer safeguards without narrowing mandatory rights', () => {
    expect(terms).toContain('Garanția noastră voluntară de rambursare în 7 zile')
    expect(terms).toContain('drept legal de retragere de 14 zile')
    expect(terms).toContain('cererea expresă de începere imediată a executării')
    expect(terms).toContain('plata proporțională a serviciului furnizat')
    expect(terms).toContain('drepturile obligatorii ale consumatorilor')
    expect(terms).toContain('Pentru utilizatorii profesionali')
    expect(terms).toContain('Pentru consumatori, răspunderea și remediile sunt guvernate de legea obligatorie')
    expect(terms).toContain('fraudei, conduitei intenționate, decesului sau vătămării corporale')
    expect(terms).toContain('legislația română')
    expect(terms).toContain('instanțelor competente din Timișoara')
  })
})
