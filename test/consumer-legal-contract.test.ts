import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const footer = read('../app/components/Footer.vue')
const contact = read('../app/pages/contact.vue')
const copyrightNotice = read('../app/pages/dmca.vue')
const terms = read('../app/pages/terms.vue')
const privacy = read('../app/pages/privacy.vue')
const cookies = read('../app/pages/cookies.vue')

describe('Romanian consumer-information surface', () => {
  test('publishes the current official ANPC SAL route without a national badge', () => {
    expect(footer).toContain('https://reclamatiisal.anpc.ro')
    expect(footer).toContain('Alternative dispute resolution')
    expect(footer).not.toContain('/images/legal/anpc-sal.svg')
    expect(footer).not.toContain('ec.europa.eu/consumers/odr')
  })

  test('places a just-in-time privacy notice beside the contact submission', () => {
    expect(contact).toContain('We use the required name, email and message')
    expect(contact).toContain('to="/privacy"')
    expect(contact).toContain('Do not include passwords, payment-card details or private access tokens')
  })

  test('uses an EU-facing copyright and illegal-content notice without claiming a US DMCA agent', () => {
    expect(copyrightNotice).toContain('Copyright & Illegal Content Notice')
    expect(copyrightNotice).toContain('illegal content')
    expect(copyrightNotice).toContain('statement of reasons')
    expect(copyrightNotice).not.toContain('penalty of perjury')
    expect(copyrightNotice).not.toContain('DMCA agent')
  })

  test('links every English legal contract to its Romanian counterpart', () => {
    expect(terms).toContain('alternate-path="/ro/terms"')
    expect(privacy).toContain('alternate-path="/ro/privacy"')
    expect(cookies).toContain('alternate-path="/ro/cookies"')
    expect(footer).toContain("{ label: 'Termeni în română', to: '/ro/terms' }")
  })
})
