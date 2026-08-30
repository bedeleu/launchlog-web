import type { PlanTier } from '~/composables/usePlans'

export const PREVIEW_COPY_LIMITS = {
  title: 120,
  tagline: 200,
  description: 2000,
} as const

export const firstPreviewCopyError = (copy: {
  title: string
  tagline: string
  description: string
}): string | null => {
  if (copy.title.length > PREVIEW_COPY_LIMITS.title) {
    return `Shorten the title to ${PREVIEW_COPY_LIMITS.title} characters or fewer.`
  }
  if (copy.tagline.length > PREVIEW_COPY_LIMITS.tagline) {
    return `Shorten the tagline to ${PREVIEW_COPY_LIMITS.tagline} characters or fewer.`
  }
  if (copy.description.length > PREVIEW_COPY_LIMITS.description) {
    return `Shorten the description to ${PREVIEW_COPY_LIMITS.description.toLocaleString('en')} characters or fewer.`
  }

  return null
}

type CheckoutSelection = {
  checkoutReserved: boolean
  previewTier: string | null | undefined
  previewEmail: string | null | undefined
  draftTier: string | null | undefined
  draftEmail: string | null | undefined
}

const isPlanTier = (value: string | null | undefined): value is PlanTier =>
  value === 'basic' || value === 'featured'

export const resolvePreviewCheckout = (selection: CheckoutSelection): {
  locked: boolean
  tier: PlanTier
  email: string
} => {
  if (selection.checkoutReserved) {
    return {
      locked: true,
      tier: isPlanTier(selection.previewTier) ? selection.previewTier : 'basic',
      email: selection.previewEmail?.trim() ?? '',
    }
  }

  return {
    locked: false,
    tier: isPlanTier(selection.draftTier)
      ? selection.draftTier
      : (isPlanTier(selection.previewTier) ? selection.previewTier : 'basic'),
    email: selection.draftEmail?.trim() || selection.previewEmail?.trim() || '',
  }
}

export const buildPreviewTextEdit = (copy: {
  title: string
  tagline: string
  description: string
}) => ({
  title: copy.title || null,
  tagline: copy.tagline || null,
  description: copy.description || null,
})
