import type { CustomerListing, CustomerListingDraft } from '~/composables/useCustomerListings'

function normalized(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

export function customerDraft(listing: CustomerListing): CustomerListingDraft {
  return {
    name: listing.name,
    tagline: listing.tagline ?? '',
    description: listing.description ?? '',
  }
}

export function isCustomerListingDirty(
  listing: CustomerListing,
  draft: CustomerListingDraft,
): boolean {
  return normalized(listing.name) !== normalized(draft.name)
    || normalized(listing.tagline) !== normalized(draft.tagline)
    || normalized(listing.description) !== normalized(draft.description)
}
