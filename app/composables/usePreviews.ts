export type PreviewStatus = 'generating' | 'ready' | 'failed' | 'converted' | 'expired'

export interface Preview {
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

/**
 * Preview-first intake (D-057). The preview is the private, pre-payment
 * artifact; it only becomes a public Listing after the payment webhook
 * converts it server-side. The opaque token is the only handle a visitor has.
 */
export const usePreviews = () => {
  const config = useRuntimeConfig()
  // apiUrl is host-only; routes/api.php is mounted under /api (D-051).
  const base = `${config.public.apiUrl}/api/v1`

  const createPreview = async (url: string): Promise<Preview> => {
    const { data } = await $fetch<{ data: Preview }>(`${base}/previews`, {
      method: 'POST',
      body: { url },
    })
    return data
  }

  const getPreview = async (token: string): Promise<Preview> => {
    const { data } = await $fetch<{ data: Preview }>(`${base}/previews/${token}`)
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

  return { createPreview, getPreview, updatePreview, recapturePreview }
}
