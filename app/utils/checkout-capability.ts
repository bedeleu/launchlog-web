import type { PlanTier } from '#shared/constants/public-plans'

export type CheckoutLegalLocale = 'en' | 'ro'

export interface CheckoutProviderSnapshot {
  legal_name: string
  legal_address: string
  registration_id: string
  tax_id: string
  share_capital: string
  phone: string
  email: string
}

export interface CheckoutOfferNotices {
  tax: string
  renewal: string
  cancellation: string
  voluntary_refund: string
}

export interface CheckoutOffer {
  tier: PlanTier
  name: string
  amount_minor: number
  currency: 'USD'
  interval: 'year'
  interval_count: 1
  quantity: 1
  stripe_price_id: string
  stripe_price_tax_behavior: 'exclusive' | 'inclusive' | 'unspecified'
  automatic_tax_enabled: boolean
  notices: Record<CheckoutLegalLocale, CheckoutOfferNotices>
}

export interface CheckoutTermsArtifact {
  url: string
  document: string
  document_sha256: string
  acceptance_text: string
  performance_request_text: string
}

export interface CheckoutCapability {
  schema_version: '1'
  capability_version: string
  capability_sha256: string
  checkout_enabled: boolean
  provider: CheckoutProviderSnapshot
  provider_sha256: string
  offers: Record<PlanTier, CheckoutOffer>
  offer_catalog_sha256: string
  legal: {
    terms_version: string
    performance_notice_version: string
    locales: Record<CheckoutLegalLocale, CheckoutTermsArtifact>
  }
}

const HASH_PATTERN = /^[0-9a-f]{64}$/
const PRICE_ID_PATTERN = /^price_[A-Za-z0-9]+$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const invalid = (): never => {
  throw new Error('The server returned an invalid checkout capability.')
}

const stringField = (record: Record<string, unknown>, key: string, max = 5000): string => {
  const value = record[key]
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) return invalid()
  return value
}

const hashField = (record: Record<string, unknown>, key: string): string => {
  const value = record[key]
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) return invalid()
  return value
}

const recordField = (record: Record<string, unknown>, key: string): Record<string, unknown> => {
  const value = record[key]
  if (!isRecord(value)) return invalid()
  return value
}

const parseNotices = (value: unknown): Record<CheckoutLegalLocale, CheckoutOfferNotices> => {
  if (!isRecord(value)) return invalid()
  const parsed = {} as Record<CheckoutLegalLocale, CheckoutOfferNotices>

  for (const locale of ['en', 'ro'] as const) {
    const notices = recordField(value, locale)
    parsed[locale] = {
      tax: stringField(notices, 'tax'),
      renewal: stringField(notices, 'renewal'),
      cancellation: stringField(notices, 'cancellation'),
      voluntary_refund: stringField(notices, 'voluntary_refund'),
    }
  }

  return parsed
}

const parseOffer = (value: unknown, tier: PlanTier): CheckoutOffer => {
  if (!isRecord(value)) return invalid()
  const taxBehavior = value.stripe_price_tax_behavior

  if (
    value.tier !== tier
    || !Number.isInteger(value.amount_minor)
    || (value.amount_minor as number) <= 0
    || value.currency !== 'USD'
    || value.interval !== 'year'
    || value.interval_count !== 1
    || value.quantity !== 1
    || typeof value.stripe_price_id !== 'string'
    || !PRICE_ID_PATTERN.test(value.stripe_price_id)
    || !['exclusive', 'inclusive', 'unspecified'].includes(String(taxBehavior))
    || typeof value.automatic_tax_enabled !== 'boolean'
  ) return invalid()

  return {
    tier,
    name: stringField(value, 'name', 120),
    amount_minor: value.amount_minor as number,
    currency: 'USD',
    interval: 'year',
    interval_count: 1,
    quantity: 1,
    stripe_price_id: value.stripe_price_id,
    stripe_price_tax_behavior: taxBehavior as CheckoutOffer['stripe_price_tax_behavior'],
    automatic_tax_enabled: value.automatic_tax_enabled,
    notices: parseNotices(value.notices),
  }
}

const parseTerms = (
  value: unknown,
  locale: CheckoutLegalLocale,
  expectedHost: string,
): CheckoutTermsArtifact => {
  if (!isRecord(value)) return invalid()
  const rawUrl = stringField(value, 'url', 500)
  let url: URL

  try {
    url = new URL(rawUrl)
  }
  catch {
    return invalid()
  }

  const expectedPath = locale === 'ro' ? '/ro/terms' : '/terms'
  if (
    url.protocol !== 'https:'
    || url.hostname !== expectedHost
    || url.port
    || url.username
    || url.password
    || url.pathname !== expectedPath
    || url.search
    || url.hash
  ) return invalid()

  return {
    url: url.href,
    document: stringField(value, 'document', 250_000),
    document_sha256: hashField(value, 'document_sha256'),
    acceptance_text: stringField(value, 'acceptance_text'),
    performance_request_text: stringField(value, 'performance_request_text'),
  }
}

export const parseCheckoutCapability = (value: unknown, configuredDomain: string): CheckoutCapability => {
  if (!isRecord(value)) return invalid()
  const expectedHost = configuredDomain.trim().toLowerCase().split(':')[0] ?? ''
  if (!expectedHost || expectedHost.includes('/') || expectedHost.includes('@')) return invalid()

  const provider = recordField(value, 'provider')
  const parsedProvider: CheckoutProviderSnapshot = {
    legal_name: stringField(provider, 'legal_name', 300),
    legal_address: stringField(provider, 'legal_address', 1000),
    registration_id: stringField(provider, 'registration_id', 120),
    tax_id: stringField(provider, 'tax_id', 120),
    share_capital: stringField(provider, 'share_capital', 120),
    phone: stringField(provider, 'phone', 120),
    email: stringField(provider, 'email', 320),
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(parsedProvider.email)) return invalid()

  const offers = recordField(value, 'offers')
  const legal = recordField(value, 'legal')
  const locales = recordField(legal, 'locales')
  const parsedLocales = {
    en: parseTerms(locales.en, 'en', expectedHost),
    ro: parseTerms(locales.ro, 'ro', expectedHost),
  }
  if (parsedLocales.en.document_sha256 === parsedLocales.ro.document_sha256) return invalid()

  if (
    value.schema_version !== '1'
    || typeof value.checkout_enabled !== 'boolean'
  ) return invalid()

  return {
    schema_version: '1',
    capability_version: stringField(value, 'capability_version', 64),
    capability_sha256: hashField(value, 'capability_sha256'),
    checkout_enabled: value.checkout_enabled,
    provider: parsedProvider,
    provider_sha256: hashField(value, 'provider_sha256'),
    offers: {
      basic: parseOffer(offers.basic, 'basic'),
      featured: parseOffer(offers.featured, 'featured'),
    },
    offer_catalog_sha256: hashField(value, 'offer_catalog_sha256'),
    legal: {
      terms_version: stringField(legal, 'terms_version', 64),
      performance_notice_version: stringField(legal, 'performance_notice_version', 64),
      locales: parsedLocales,
    },
  }
}
