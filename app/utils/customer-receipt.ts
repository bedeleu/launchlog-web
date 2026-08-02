import type { CustomerListingStatus } from '~/composables/useCustomerListings'

export function receiptUnavailableLabel(status: CustomerListingStatus): 'Pending' | 'Not published' | 'Unavailable' {
  if (status === 'draft' || status === 'pending_review') return 'Pending'
  if (status === 'archived' || status === 'rejected' || status === 'spam') return 'Not published'
  return 'Unavailable'
}
