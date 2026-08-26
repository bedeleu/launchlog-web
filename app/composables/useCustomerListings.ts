import type { PlanTier } from '~/composables/usePlans'
import { reactive, ref } from 'vue'

export type CustomerListingStatus = 'draft' | 'pending_review' | 'published' | 'archived' | 'spam' | 'rejected'
export type CustomerSubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'paused'

export interface CustomerListingSubscription {
  status: CustomerSubscriptionStatus
  tier: PlanTier
  current_period_start: string
  current_period_end: string
  canceled_at: string | null
}

export interface CustomerListing {
  id: string
  slug: string
  name: string
  tagline: string | null
  description: string | null
  url: string
  screenshot_url: string | null
  status: CustomerListingStatus
  tier: PlanTier | null
  published_at: string | null
  expires_at: string | null
  subscription: CustomerListingSubscription | null
  receipt: {
    public_url: string
    schema_url?: string
    markdown_url: string
    sitemap_url: string
    llms_url: string
    checks: Record<'published' | 'schema' | 'markdown' | 'llms', boolean>
  }
}

export interface CustomerListingUpdate {
  name?: string
  tagline?: string | null
  description?: string | null
}

export interface CustomerListingDraft {
  name: string
  tagline: string
  description: string
}

export const useCustomerDashboardState = () => {
  const listings = ref<CustomerListing[]>([])
  const drafts = reactive<Record<string, CustomerListingDraft>>({})
  const actionErrors = reactive<Record<string, string | null>>({})
  const savingIds = reactive(new Set<string>())
  const billingIds = reactive(new Set<string>())
  const savedIds = reactive(new Set<string>())

  const syncDraft = (listing: CustomerListing): void => {
    drafts[listing.id] = {
      name: listing.name,
      tagline: listing.tagline ?? '',
      description: listing.description ?? '',
    }
  }

  const syncListings = (items: CustomerListing[]): void => {
    listings.value = items
    for (const listing of items) syncDraft(listing)
  }

  const clearPrivateData = (): void => {
    listings.value = []
    savingIds.clear()
    billingIds.clear()
    savedIds.clear()
    for (const key of Object.keys(drafts)) Reflect.deleteProperty(drafts, key)
    for (const key of Object.keys(actionErrors)) Reflect.deleteProperty(actionErrors, key)
  }

  return {
    listings,
    drafts,
    actionErrors,
    savingIds,
    billingIds,
    savedIds,
    syncDraft,
    syncListings,
    clearPrivateData,
    beginSaving: (id: string) => savingIds.add(id),
    finishSaving: (id: string) => savingIds.delete(id),
    beginBilling: (id: string) => billingIds.add(id),
    finishBilling: (id: string) => billingIds.delete(id),
    markSaved: (id: string) => savedIds.add(id),
    clearSaved: (id: string) => savedIds.delete(id),
  }
}

export const useCustomerListings = () => {
  const config = useRuntimeConfig()
  const base = `${config.public.apiUrl}/api/v1/dashboard/listings`
  const { getIdToken } = useAuth()

  const authHeaders = async (): Promise<Record<string, string>> => {
    const token = await getIdToken()
    if (!token) throw new Error('Not authenticated')
    return { Authorization: `Bearer ${token}` }
  }

  const list = async (): Promise<CustomerListing[]> => {
    const { data } = await $fetch<{ data: CustomerListing[] }>(base, {
      headers: await authHeaders(),
    })
    return data
  }

  const update = async (id: string, fields: CustomerListingUpdate): Promise<CustomerListing> => {
    const { data } = await $fetch<{ data: CustomerListing }>(`${base}/${id}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: fields,
    })
    return data
  }

  const billingPortal = async (id: string): Promise<string> => {
    const { data } = await $fetch<{ data: { url: string } }>(`${base}/${id}/billing-portal`, {
      method: 'POST',
      headers: await authHeaders(),
      body: {},
    })

    let target: URL
    try {
      target = new URL(data.url)
    }
    catch {
      throw new Error('Invalid billing portal URL')
    }

    if (target.protocol !== 'https:' || target.hostname !== 'billing.stripe.com') {
      throw new Error('Invalid billing portal URL')
    }

    return target.toString()
  }

  return { list, update, billingPortal }
}
