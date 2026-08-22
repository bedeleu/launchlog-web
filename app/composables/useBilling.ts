import type { PlanTier } from '~/composables/usePlans'

export type CheckoutSession = {
  session_id: string
  url: string
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
    const body = idToken
      ? {
          preview_token: input.preview_token,
          tier: input.tier,
        }
      : {
          preview_token: input.preview_token,
          tier: input.tier,
          email: input.email,
        }

    const { data } = await $fetch<{ data: CheckoutSession }>(`${base}/checkout/session`, {
      method: 'POST',
      body,
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
    })
    return data
  }

  // The signal lets a caller enforce a hard deadline: an in-flight poll is
  // aborted rather than left hanging past it.
  const getConversion = async (token: string, signal?: AbortSignal): Promise<ConversionStatus> => {
    const { data } = await $fetch<{ data: ConversionStatus }>(`${base}/previews/${token}/conversion`, {
      signal,
    })
    return data
  }

  return { createSession, getConversion }
}
