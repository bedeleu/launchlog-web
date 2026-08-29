import { describe, expect, test } from 'bun:test'
import {
  assertProductionLegalIdentity,
  isProductionDeployment,
} from './legal-readiness'

const completeIdentity = {
  legalName: 'Registered provider',
  legalAddress: 'Strada Exemplu nr. 1, Timișoara, Timiș, 300000, România',
  legalRegistrationId: 'Registration number',
  legalTaxId: 'Tax ID',
  legalShareCapital: 'RON 200',
  legalPhone: '+40 000 000 000',
  legalEmail: 'legal@example.com',
  taxNoticeEn: 'Tax treatment confirmed by the accountant.',
  taxNoticeRo: 'Tratamentul fiscal este confirmat de contabil.',
}

describe('production legal readiness', () => {
  test('detects explicit, Railway and Vercel deployment without blocking ordinary builds or previews', () => {
    expect(isProductionDeployment({ NUXT_DEPLOY_ENVIRONMENT: 'production' })).toBe(true)
    expect(isProductionDeployment({ RAILWAY_ENVIRONMENT_NAME: 'production' })).toBe(true)
    expect(isProductionDeployment({ VERCEL_ENV: 'production' })).toBe(true)
    expect(isProductionDeployment({ NUXT_DEPLOY_ENVIRONMENT: 'preview' })).toBe(false)
    expect(isProductionDeployment({ RAILWAY_ENVIRONMENT_NAME: 'staging' })).toBe(false)
    expect(isProductionDeployment({ VERCEL_ENV: 'preview' })).toBe(false)
    expect(isProductionDeployment({})).toBe(false)
  })

  test('blocks a production build when any formal provider fact is missing', () => {
    expect(() => assertProductionLegalIdentity(
      { RAILWAY_ENVIRONMENT_NAME: 'production' },
      { ...completeIdentity, legalTaxId: '   ' },
    )).toThrow('NUXT_PUBLIC_LEGAL_TAX_ID')
  })

  test('blocks provider-independent production when the explicit deployment marker is set', () => {
    expect(() => assertProductionLegalIdentity(
      { NUXT_DEPLOY_ENVIRONMENT: 'production' },
      { ...completeIdentity, legalAddress: '' },
    )).toThrow('NUXT_PUBLIC_LEGAL_ADDRESS')
  })

  test('allows a production build only with every formal provider fact', () => {
    expect(() => assertProductionLegalIdentity(
      { VERCEL_ENV: 'production' },
      completeIdentity,
    )).not.toThrow()
  })

  test('requires a six-digit Romanian postal code and a valid legal mailbox', () => {
    expect(() => assertProductionLegalIdentity(
      { RAILWAY_ENVIRONMENT_NAME: 'production' },
      { ...completeIdentity, legalAddress: 'Timișoara 3003691' },
    )).toThrow('six-digit postal code')
    expect(() => assertProductionLegalIdentity(
      { RAILWAY_ENVIRONMENT_NAME: 'production' },
      { ...completeIdentity, legalEmail: 'not-an-email' },
    )).toThrow('valid public email')
  })

  test('does not require invented legal facts for local builds', () => {
    expect(() => assertProductionLegalIdentity({}, {
      legalName: '',
      legalAddress: '',
      legalRegistrationId: '',
      legalTaxId: '',
      legalShareCapital: '',
      legalPhone: '',
      legalEmail: '',
      taxNoticeEn: '',
      taxNoticeRo: '',
    })).not.toThrow()
  })

  test('requires separately approved English and Romanian tax notices', () => {
    expect(() => assertProductionLegalIdentity(
      { NUXT_DEPLOY_ENVIRONMENT: 'production' },
      { ...completeIdentity, taxNoticeRo: '' },
    )).toThrow('NUXT_PUBLIC_TAX_NOTICE_RO')
    expect(() => assertProductionLegalIdentity(
      { NUXT_DEPLOY_ENVIRONMENT: 'production' },
      { ...completeIdentity, taxNoticeEn: '' },
    )).toThrow('NUXT_PUBLIC_TAX_NOTICE_EN')
  })
})
