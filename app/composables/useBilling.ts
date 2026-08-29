import type { PlanTier } from '~/composables/usePlans'
import { parseCheckoutCapability } from '../utils/checkout-capability'
import type { CheckoutCapability, CheckoutLegalLocale } from '../utils/checkout-capability'

export type CheckoutSession = {
  session_id: string
  url: string
  agreement_reference: string
  created_new_session: boolean
}

export type ConversionStatus = {
  status: 'pending' | 'converted' | 'expired'
  listing_slug: string | null
}

export type CreateSessionInput = {
  preview_token: string
  tier: PlanTier
  /**
   * Always supplied by the caller. Whether it reaches the wire is decided here
   * and only here: a signed-in buyer's request carries the Firebase token and
   * no email, so the API resolves identity server-side and the body can never
   * name a different account.
   */
  email: string
  terms_accepted: boolean
  terms_version: string
  immediate_performance_requested: boolean
  performance_notice_version: string
  legal_locale: CheckoutLegalLocale
  checkout_capability_version: string
  checkout_capability_sha256: string
  provider_sha256: string
  offer_catalog_sha256: string
  terms_document_sha256: string
}

const CHECKOUT_SESSION_ID_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9]+$/
const AGREEMENT_REFERENCE_PATTERN = /^lla_[0-9a-z]{26}$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const parseStripeCheckoutSession = (value: unknown): CheckoutSession => {
  if (
    !isRecord(value)
    || typeof value.session_id !== 'string'
    || !CHECKOUT_SESSION_ID_PATTERN.test(value.session_id)
    || typeof value.url !== 'string'
    || typeof value.agreement_reference !== 'string'
    || !AGREEMENT_REFERENCE_PATTERN.test(value.agreement_reference)
    || typeof value.created_new_session !== 'boolean'
  ) {
    throw new Error('The checkout provider returned an invalid session.')
  }

  let url: URL
  try {
    url = new URL(value.url)
  }
  catch {
    throw new Error('The checkout provider returned an invalid session.')
  }

  if (
    url.protocol !== 'https:'
    || url.hostname !== 'checkout.stripe.com'
    || url.port
    || url.username
    || url.password
    || url.pathname !== `/c/pay/${value.session_id}`
  ) {
    throw new Error('The checkout provider returned an invalid session.')
  }

  return {
    session_id: value.session_id,
    url: url.href,
    agreement_reference: value.agreement_reference,
    created_new_session: value.created_new_session,
  }
}

/**
 * Payment surface (D-057): the browser only asks the API for a Stripe-hosted
 * Checkout URL and then polls conversion. No Stripe SDK, no card fields, and
 * no Stripe key ever reaches the client — publication happens server-side on
 * the verified webhook.
 */
export const useBilling = () => {
  const config = useRuntimeConfig()
  const { getIdToken } = useAuth()
  // apiUrl is host-only; routes/api.php is mounted under /api (D-051).
  const base = `${config.public.apiUrl}/api/v1`

  const createSession = async (input: CreateSessionInput): Promise<CheckoutSession> => {
    const idToken = await getIdToken()
    const legalDecisions = {
      terms_accepted: input.terms_accepted,
      terms_version: input.terms_version,
      immediate_performance_requested: input.immediate_performance_requested,
      performance_notice_version: input.performance_notice_version,
      legal_locale: input.legal_locale,
      checkout_capability_version: input.checkout_capability_version,
      checkout_capability_sha256: input.checkout_capability_sha256,
      provider_sha256: input.provider_sha256,
      offer_catalog_sha256: input.offer_catalog_sha256,
      terms_document_sha256: input.terms_document_sha256,
    }
    const body = idToken
      ? {
          preview_token: input.preview_token,
          tier: input.tier,
          ...legalDecisions,
        }
      : {
          preview_token: input.preview_token,
          tier: input.tier,
          email: input.email,
          ...legalDecisions,
        }

    const response = await $fetch<unknown>(`${base}/checkout/session`, {
      method: 'POST',
      body,
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
    })

    if (!isRecord(response)) {
      throw new Error('The checkout provider returned an invalid session.')
    }

    return parseStripeCheckoutSession(response.data)
  }

  const getCheckoutCapability = async (): Promise<CheckoutCapability> => {
    const response = await $fetch<unknown>(`${base}/checkout/capability`)
    if (!isRecord(response)) {
      throw new Error('The server returned an invalid checkout capability.')
    }

    return parseCheckoutCapability(response.data, String(config.public.domain ?? ''))
  }

  // The signal lets a caller enforce a hard deadline: an in-flight poll is
  // aborted rather than left hanging past it.
  const getConversion = async (token: string, signal?: AbortSignal): Promise<ConversionStatus> => {
    const { data } = await $fetch<{ data: ConversionStatus }>(`${base}/previews/${token}/conversion`, {
      signal,
    })
    return data
  }

  return { createSession, getCheckoutCapability, getConversion }
}
