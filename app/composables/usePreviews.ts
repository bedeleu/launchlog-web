export type PreviewStatus = 'generating' | 'ready' | 'failed' | 'converted' | 'expired'

export interface ExistingListingConflict {
  action: 'manage' | 'claim'
  domain: string
  listing_path: string | null
  dashboard_path: string | null
}

export interface Preview {
  created_new_preview?: boolean
  token: string
  status: PreviewStatus
  source_url: string
  url: string
  domain: string
  title: string | null
  tagline: string | null
  description: string | null
  primary_category_id: string | null
  email: string | null
  tier: string | null
  screenshot_url: string | null
  crawl: Record<string, unknown> | null
  error_code: string | null
  error_message: string | null
  existing_listing: ExistingListingConflict | null
  checkout_reserved: boolean
  expires_at: string | null
}

export interface PreviewEdit {
  title?: string | null
  tagline?: string | null
  description?: string | null
  primary_category_id?: string | null
  email?: string | null
  tier?: string | null
}

export const existingListingConflictFromError = (error: unknown): ExistingListingConflict | null => {
  const response = error as {
    data?: {
      error?: unknown
      conflict?: Record<string, unknown>
    }
  }
  const conflict = response.data?.conflict

  if (response.data?.error !== 'listing_exists' || !conflict) return null
  if (conflict.action !== 'manage' && conflict.action !== 'claim') return null
  if (typeof conflict.domain !== 'string' || !conflict.domain.trim()) return null

  return {
    action: conflict.action,
    domain: conflict.domain,
    listing_path: typeof conflict.listing_path === 'string' ? conflict.listing_path : null,
    dashboard_path: typeof conflict.dashboard_path === 'string' ? conflict.dashboard_path : null,
  }
}

/**
 * Preview-first intake (D-057). The preview is the private, pre-payment
 * artifact; it only becomes a public Listing after the payment webhook
 * converts it server-side. The opaque token is the only handle a visitor has.
 */
export const usePreviews = () => {
  const config = useRuntimeConfig()
  const { getIdToken, waitForAuthReady } = useAuth()
  // apiUrl is host-only; routes/api.php is mounted under /api (D-051).
  const base = `${config.public.apiUrl}/api/v1`

  const authHeaders = async (): Promise<Record<string, string> | undefined> => {
    await waitForAuthReady()
    const token = await getIdToken()
    return token ? { Authorization: `Bearer ${token}` } : undefined
  }

  const createPreview = async (url: string): Promise<Preview> => {
    const { data } = await $fetch<{ data: Preview }>(`${base}/previews`, {
      method: 'POST',
      body: { url },
      headers: await authHeaders(),
    })
    return data
  }

  const getPreview = async (token: string): Promise<Preview> => {
    const { data } = await $fetch<{ data: Preview }>(`${base}/previews/${token}`, {
      headers: await authHeaders(),
    })
    return data
  }

  const updatePreview = async (token: string, payload: PreviewEdit): Promise<Preview> => {
    const { data } = await $fetch<{ data: Preview }>(`${base}/previews/${token}`, {
      method: 'PATCH',
      body: payload,
    })
    return data
  }

  const recapturePreview = async (token: string): Promise<Preview> => {
    const { data } = await $fetch<{ data: Preview }>(`${base}/previews/${token}/recapture`, {
      method: 'POST',
    })
    return data
  }

  const cancelPreviewCheckout = async (token: string): Promise<Preview> => {
    const { data } = await $fetch<{ data: Preview }>(`${base}/previews/${token}/checkout/cancel`, {
      method: 'POST',
      headers: await authHeaders(),
    })
    return data
  }

  return { createPreview, getPreview, updatePreview, recapturePreview, cancelPreviewCheckout }
}
