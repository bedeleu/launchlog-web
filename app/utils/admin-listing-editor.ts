export interface AdminListingEditValues {
  name: string
  tagline: string
  description: string
  primary_category_id: string
  country: string
  tier: string
}

const optional = (value: string): string | null => {
  const normalized = value.trim()
  return normalized === '' ? null : normalized
}

export const buildAdminListingUpdate = (values: AdminListingEditValues): Record<string, string | null> => ({
  name: values.name.trim(),
  tagline: optional(values.tagline),
  description: optional(values.description),
  primary_category_id: optional(values.primary_category_id),
  country: optional(values.country)?.toUpperCase() ?? null,
  tier: optional(values.tier),
})
