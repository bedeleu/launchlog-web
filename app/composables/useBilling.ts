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
  // apiUrl is host-only; routes/api.php is mounted under /api (D-051).
  const base = `${config.public.apiUrl}/api/v1`

  const createSession = async (input: CreateSessionInput): Promise<CheckoutSession> => {
    const { data } = await $fetch<{ data: CheckoutSession }>(`${base}/checkout/session`, {
      method: 'POST',
      body: {
        preview_token: input.preview_token,
        tier: input.tier,
        email: input.email,
      },
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
