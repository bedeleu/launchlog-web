import {
  listingAbsenceStatus,
  type ListingAbsenceStatus,
} from '#shared/utils/listing-http-status'
import type { Listing } from '../../app/composables/useListings'

interface ListingEnvelope {
  data?: Listing | null
}

export async function fetchListingProof(slug: string): Promise<{ listing: Listing, domain: string }> {
  const config = useRuntimeConfig()

  try {
    const envelope = await $fetch<ListingEnvelope>(`${config.public.apiUrl}/api/v1/listings/${slug}`)
    const listing = envelope?.data ?? null
    const absenceStatus = listingAbsenceStatus(undefined, listing)

    if (absenceStatus || !listing) throw listingProofError(absenceStatus ?? 404)

    return { listing, domain: config.public.domain as string }
  }
  catch (error) {
    const absenceStatus = listingAbsenceStatus(error, undefined)
    if (absenceStatus) throw listingProofError(absenceStatus)
    throw error
  }
}

function listingProofError(statusCode: ListingAbsenceStatus): ReturnType<typeof createError> {
  return createError({
    statusCode,
    statusMessage: statusCode === 410 ? 'Listing withdrawn' : 'Listing not found',
  })
}
