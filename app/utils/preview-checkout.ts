import type { PlanTier } from '~/composables/usePlans'

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
