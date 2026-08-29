export interface FormalLegalIdentity {
  legalName: string | undefined
  legalAddress: string | undefined
  legalRegistrationId: string | undefined
  legalTaxId: string | undefined
  legalPhone: string | undefined
  legalEmail: string | undefined
  taxNoticeEn: string | undefined
  taxNoticeRo: string | undefined
}

export interface DeploymentEnvironment {
  NUXT_DEPLOY_ENVIRONMENT?: string
  RAILWAY_ENVIRONMENT_NAME?: string
  VERCEL_ENV?: string
}

const LEGAL_ENV_KEYS: Record<keyof FormalLegalIdentity, string> = {
  legalName: 'NUXT_PUBLIC_LEGAL_NAME',
  legalAddress: 'NUXT_PUBLIC_LEGAL_ADDRESS',
  legalRegistrationId: 'NUXT_PUBLIC_LEGAL_REGISTRATION_ID',
  legalTaxId: 'NUXT_PUBLIC_LEGAL_TAX_ID',
  legalPhone: 'NUXT_PUBLIC_LEGAL_PHONE',
  legalEmail: 'NUXT_PUBLIC_LEGAL_EMAIL',
  taxNoticeEn: 'NUXT_PUBLIC_TAX_NOTICE_EN',
  taxNoticeRo: 'NUXT_PUBLIC_TAX_NOTICE_RO',
}

export const isProductionDeployment = (environment: DeploymentEnvironment): boolean =>
  environment.NUXT_DEPLOY_ENVIRONMENT?.toLowerCase() === 'production'
  || environment.RAILWAY_ENVIRONMENT_NAME?.toLowerCase() === 'production'
  || environment.VERCEL_ENV?.toLowerCase() === 'production'

export const assertProductionLegalIdentity = (
  environment: DeploymentEnvironment,
  identity: FormalLegalIdentity,
): void => {
  if (!isProductionDeployment(environment)) return

  const missing = (Object.keys(LEGAL_ENV_KEYS) as Array<keyof FormalLegalIdentity>)
    .filter(key => !identity[key]?.trim())
    .map(key => LEGAL_ENV_KEYS[key])

  if (missing.length > 0) {
    throw new Error(`Production legal identity is incomplete: ${missing.join(', ')}`)
  }

  if (!/(?:^|\D)\d{6}(?:\D|$)/u.test(identity.legalAddress!)) {
    throw new Error('NUXT_PUBLIC_LEGAL_ADDRESS must include a six-digit postal code for Romania')
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(identity.legalEmail!)) {
    throw new Error('NUXT_PUBLIC_LEGAL_EMAIL must be a valid public email address')
  }
}
