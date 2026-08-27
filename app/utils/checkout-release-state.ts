export type CheckoutReleaseState = 'waiting' | 'converted' | 'expired' | 'timeout' | 'unverifiable'

export interface CheckoutReleaseCopy {
  eyebrow: string
  title: string
  description: string
  marker: string
  markerDetail: string
  tone: 'active' | 'success' | 'warning'
}

export function checkoutReleaseCopy(state: CheckoutReleaseState): CheckoutReleaseCopy {
  const copy = {
    waiting: {
      eyebrow: 'Payment recorded · release processing',
      title: 'Preparing the public release record',
      description: 'Stripe has returned control to LaunchLog. Publication is confirmed only after the signed webhook converts this private preview.',
      marker: 'Conversion pending',
      markerDetail: 'Keep this page open while the public listing is created.',
      tone: 'active',
    },
    converted: {
      eyebrow: 'Release published',
      title: 'The listing is live in the catalog',
      description: 'The public record and its machine-readable discovery surfaces are now available.',
      marker: 'Publication confirmed',
      markerDetail: 'The webhook conversion completed and returned a public listing address.',
      tone: 'success',
    },
    expired: {
      eyebrow: 'Release needs support',
      title: 'The private preview expired',
      description: 'The preview closed before publication could be confirmed. If payment completed, support will publish the listing or issue a refund.',
      marker: 'Publication not confirmed',
      markerDetail: 'No public listing is claimed from this page state.',
      tone: 'warning',
    },
    timeout: {
      eyebrow: 'Payment safe · processing continues',
      title: 'Publication is taking longer than usual',
      description: 'Nothing has been marked failed or published prematurely. Retry the signed status check or contact support with the Stripe reference below.',
      marker: 'Status check timed out',
      markerDetail: 'LaunchLog still needs a confirmed conversion before showing a public link.',
      tone: 'active',
    },
    unverifiable: {
      eyebrow: 'Release reference missing',
      title: 'This status link cannot be verified',
      description: 'The private preview reference is missing or malformed. If payment completed, support can reconcile it from the Stripe receipt.',
      marker: 'Manual reconciliation required',
      markerDetail: 'No publication result is inferred from an incomplete link.',
      tone: 'warning',
    },
  } satisfies Record<CheckoutReleaseState, CheckoutReleaseCopy>

  return copy[state]
}
