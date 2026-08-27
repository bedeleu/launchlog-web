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
  batch_id: string | null
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

export interface PreviewAiSuggestion {
  current: AiEnrichmentPayload
  proposed: AiEnrichmentPayload
  evidence: Record<string, unknown>
  model: string
}

export interface AiEnrichmentBatch {
  id: string
  status: 'queued' | 'running' | 'ready' | 'reviewed'
  filters: Record<string, string>
  total: number
  completed: number
  failed: number
  applied: number
  proposals?: AiEnrichmentProposal[]
  created_at: string
}

export interface AiBatchRequest {
  limit: number
  filters: {
    status?: string
    tier?: string
    source?: string
  }
}

export const useAiEnrichment = () => {
  const config = useRuntimeConfig()
  const root = `${config.public.apiUrl}/api/v1`
  const { getIdToken, waitForAuthReady } = useAuth()

  const authHeaders = async (optional = false): Promise<Record<string, string> | undefined> => {
    await waitForAuthReady()
    const token = await getIdToken()
    if (!token && !optional) throw new Error('Not authenticated')
    return token ? { Authorization: `Bearer ${token}` } : undefined
  }

  const suggestPreview = async (token: string): Promise<PreviewAiSuggestion> => {
    const { data } = await $fetch<{ data: PreviewAiSuggestion }>(`${root}/previews/${token}/ai-suggestion`, {
      method: 'POST',
      headers: await authHeaders(true),
    })
    return data
  }

  const generateOwnerProposal = async (listingId: string): Promise<AiEnrichmentProposal> => {
    const { data } = await $fetch<{ data: AiEnrichmentProposal }>(`${root}/dashboard/listings/${listingId}/ai-proposals`, {
      method: 'POST',
      headers: await authHeaders(),
    })
    return data
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

  const createBatch = async (request: AiBatchRequest): Promise<AiEnrichmentBatch> => {
    const { data } = await $fetch<{ data: AiEnrichmentBatch }>(`${root}/admin/ai-enrichment/batches`, {
      method: 'POST',
      headers: await authHeaders(),
      body: request,
    })
    return data
  }

  const getBatch = async (batchId: string): Promise<AiEnrichmentBatch> => {
    const { data } = await $fetch<{ data: AiEnrichmentBatch }>(`${root}/admin/ai-enrichment/batches/${batchId}`, {
      headers: await authHeaders(),
    })
    return data
  }

  const applyBatch = async (batchId: string, proposalIds: string[], fields: AiEnrichmentField[]): Promise<AiEnrichmentBatch> => {
    const { data } = await $fetch<{ data: AiEnrichmentBatch }>(`${root}/admin/ai-enrichment/batches/${batchId}/apply`, {
      method: 'POST',
      headers: await authHeaders(),
      body: { proposal_ids: proposalIds, fields },
    })
    return data
  }

  return {
    suggestPreview,
    generateOwnerProposal,
    applyOwnerProposal,
    rejectOwnerProposal,
    generateAdminProposal,
    applyAdminProposal,
    rejectAdminProposal,
    approveAdminCategory,
    createBatch,
    getBatch,
    applyBatch,
  }
}
