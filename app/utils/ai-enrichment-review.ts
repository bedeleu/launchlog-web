import type { AiEnrichmentField, AiEnrichmentPayload } from '~/composables/useAiEnrichment'

const comparable = (value: unknown) => Array.isArray(value)
  ? JSON.stringify([...value].sort())
  : value ?? null

const fieldValue = (payload: AiEnrichmentPayload, field: AiEnrichmentField) => {
  if (field === 'name') return payload.name ?? payload.title ?? null
  if (field === 'category') return payload.category_id ?? payload.category_slug ?? payload.category_name ?? null
  return payload[field]
}

export const aiFieldDisplayValue = (payload: AiEnrichmentPayload, field: AiEnrichmentField): string => {
  if (field === 'name') return payload.name ?? payload.title ?? '—'
  if (field === 'category') return payload.category_name ?? payload.category_slug ?? 'Uncategorized'
  if (field === 'social_links') return payload.social_links?.join('\n') || '—'
  return payload[field] || '—'
}

export const aiFieldLinks = (payload: AiEnrichmentPayload, field: AiEnrichmentField): string[] => {
  if (field === 'social_links') return payload.social_links ?? []
  if (field === 'logo_url' && payload.logo_url) return [payload.logo_url]
  return []
}

export const changedAiFields = (
  current: AiEnrichmentPayload,
  proposed: AiEnrichmentPayload,
  allowed: AiEnrichmentField[],
): AiEnrichmentField[] => allowed.filter(field => (
  comparable(fieldValue(current, field)) !== comparable(fieldValue(proposed, field))
))

export const previewEditFromSuggestion = (
  current: { title: string; tagline: string; description: string; primary_category_id: string | null },
  proposed: AiEnrichmentPayload,
  selected: AiEnrichmentField[],
) => ({
  title: selected.includes('name') ? (proposed.title ?? proposed.name ?? current.title) : current.title,
  tagline: selected.includes('tagline') ? (proposed.tagline ?? current.tagline) : current.tagline,
  description: selected.includes('description') ? (proposed.description ?? current.description) : current.description,
  primary_category_id: selected.includes('category') ? (proposed.category_id ?? current.primary_category_id) : current.primary_category_id,
})
