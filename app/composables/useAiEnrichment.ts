export type AiEnrichmentField = 'name' | 'tagline' | 'description' | 'category' | 'logo_url' | 'social_links'

export interface AiEnrichmentPayload {
  name?: string | null
  title?: string | null
  tagline?: string | null
  description?: string | null
  category_id?: string | null
  category_slug?: string | null
  category_name?: string | null
  category_requires_approval?: boolean
  logo_url?: string | null
  social_links?: string[]
}

export interface AiEnrichmentProposal {
  id: string
  listing_id: string
  status: 'pending' | 'applied' | 'rejected'
  current: AiEnrichmentPayload
  proposed: AiEnrichmentPayload
  category: {
    slug: string | null
    name: string | null
    requires_approval: boolean
  }
  evidence: Record<string, unknown>
  model: string
  applied_fields: AiEnrichmentField[]
  created_at: string
}

export interface AiGenerationQuota {
  eligible: boolean
  used: number
  limit: number
  remaining: number
  period_start: string | null
  period_end: string | null
}

export const useAiEnrichment = () => {
  const config = useRuntimeConfig()
  const root = `${config.public.apiUrl}/api/v1`
  const { getIdToken, waitForAuthReady } = useAuth()

  const authHeaders = async (): Promise<Record<string, string>> => {
    await waitForAuthReady()
    const token = await getIdToken()
    if (!token) throw new Error('Not authenticated')
    return { Authorization: `Bearer ${token}` }
  }

  const listOwnerProposals = async (listingId: string): Promise<{ proposals: AiEnrichmentProposal[], quota: AiGenerationQuota }> => {
    const { data, meta } = await $fetch<{
      data: AiEnrichmentProposal[]
      meta: { ai_quota: AiGenerationQuota }
    }>(`${root}/dashboard/listings/${listingId}/ai-proposals`, {
      headers: await authHeaders(),
    })

    return { proposals: data, quota: meta.ai_quota }
  }

  const generateOwnerProposal = async (listingId: string): Promise<{ proposal: AiEnrichmentProposal, quota: AiGenerationQuota }> => {
    const { data, meta } = await $fetch<{
      data: AiEnrichmentProposal
      meta: { ai_quota: AiGenerationQuota }
    }>(`${root}/dashboard/listings/${listingId}/ai-proposals`, {
      method: 'POST',
      headers: await authHeaders(),
    })

    return { proposal: data, quota: meta.ai_quota }
  }

  const applyOwnerProposal = async (proposalId: string, fields: AiEnrichmentField[]): Promise<AiEnrichmentProposal> => {
    const { data } = await $fetch<{ data: AiEnrichmentProposal }>(`${root}/dashboard/ai-proposals/${proposalId}/apply`, {
      method: 'POST',
      headers: await authHeaders(),
      body: { fields },
    })
    return data
  }

  const rejectOwnerProposal = async (proposalId: string): Promise<AiEnrichmentProposal> => {
    const { data } = await $fetch<{ data: AiEnrichmentProposal }>(`${root}/dashboard/ai-proposals/${proposalId}/reject`, {
      method: 'POST',
      headers: await authHeaders(),
    })
    return data
  }

  const generateAdminProposal = async (listingId: string): Promise<AiEnrichmentProposal> => {
    const { data } = await $fetch<{ data: AiEnrichmentProposal }>(`${root}/admin/listings/${listingId}/ai-proposals`, {
      method: 'POST',
      headers: await authHeaders(),
    })
    return data
  }

  const listAdminProposals = async (listingId: string): Promise<AiEnrichmentProposal[]> => {
    const { data } = await $fetch<{ data: AiEnrichmentProposal[] }>(`${root}/admin/listings/${listingId}/ai-proposals`, {
      headers: await authHeaders(),
    })
    return data
  }

  const applyAdminProposal = async (proposalId: string, fields: AiEnrichmentField[]): Promise<AiEnrichmentProposal> => {
    const { data } = await $fetch<{ data: AiEnrichmentProposal }>(`${root}/admin/ai-proposals/${proposalId}/apply`, {
      method: 'POST',
      headers: await authHeaders(),
      body: { fields },
    })
    return data
  }

  const rejectAdminProposal = async (proposalId: string): Promise<AiEnrichmentProposal> => {
    const { data } = await $fetch<{ data: AiEnrichmentProposal }>(`${root}/admin/ai-proposals/${proposalId}/reject`, {
      method: 'POST',
      headers: await authHeaders(),
    })
    return data
  }

  const approveAdminCategory = async (proposalId: string): Promise<AiEnrichmentProposal> => {
    const { data } = await $fetch<{ data: AiEnrichmentProposal }>(`${root}/admin/ai-proposals/${proposalId}/approve-category`, {
      method: 'POST',
      headers: await authHeaders(),
    })
    return data
  }

  return {
    listOwnerProposals,
    generateOwnerProposal,
    applyOwnerProposal,
    rejectOwnerProposal,
    listAdminProposals,
    generateAdminProposal,
    applyAdminProposal,
    rejectAdminProposal,
    approveAdminCategory,
  }
}
