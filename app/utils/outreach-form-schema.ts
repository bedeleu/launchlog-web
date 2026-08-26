import { z } from 'zod'

const MAX_INTEGER = 2_147_483_647
const CAMPAIGN_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CANONICAL_ULID = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/

function codePointCount(value: string): number {
  return Array.from(value).length
}

function requiredText(limit: number) {
  return z.string()
    .transform(value => value.trim())
    .refine(value => value.length > 0)
    .refine(value => codePointCount(value) <= limit)
}

function nullableText(limit: number) {
  return z.union([z.string(), z.null()])
    .transform(value => value === null ? null : (value.trim() || null))
    .refine(value => value === null || codePointCount(value) <= limit)
}

function optionalNullableText(limit: number) {
  return z.union([z.string(), z.null()])
    .transform(value => value === null ? null : (value.trim() || null))
    .refine(value => value === null || codePointCount(value) <= limit)
    .optional()
}

const campaignKeySchema = z.string()
  .transform(value => value.trim())
  .refine(value => codePointCount(value) <= 80)
  .refine(value => CAMPAIGN_KEY.test(value))

const canonicalUlidSchema = z.string().regex(CANONICAL_ULID)

const boundedRevisionSchema = z.number().int().min(0).max(MAX_INTEGER)

const countryCodeSchema = z.union([z.string(), z.null()])
  .transform(value => value === null ? null : (value.trim().toUpperCase() || null))
  .refine(value => value === null || /^[A-Z]{2}$/.test(value))

const optionalCountryCodeSchema = z.union([z.string(), z.null()])
  .transform(value => value === null ? null : (value.trim().toUpperCase() || null))
  .refine(value => value === null || /^[A-Z]{2}$/.test(value))
  .optional()

const businessEmailSchema = z.string()
  .transform(value => value.trim().toLowerCase())
  .refine(value => codePointCount(value) <= 255)
  .refine(value => !/^[=+\-@]/.test(value))
  .pipe(z.string().email())

const assistedUrlSchema = z.string()
  .transform(value => value.trim())
  .refine(value => codePointCount(value) <= 2048)
  .refine((value) => {
    if (!/^https?:\/\/[^/]/i.test(value)) return false

    try {
      const url = new URL(value)
      return (url.protocol === 'http:' || url.protocol === 'https:')
        && url.hostname.length > 0
        && url.username === ''
        && url.password === ''
    }
    catch {
      return false
    }
  })

export const outreachCampaignCreateSchema = z.object({
  name: requiredText(120),
  key: campaignKeySchema,
  sender_identity_label: requiredText(120),
})

export const outreachCampaignUpdateSchema = z.object({
  name: requiredText(120).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  sender_identity_label: requiredText(120).optional(),
}).refine(
  value => value.name !== undefined || value.status !== undefined || value.sender_identity_label !== undefined,
)

export const outreachCandidateCreateSchema = z.object({
  campaign_key: campaignKeySchema,
  company_name: requiredText(120),
  product_name: requiredText(120),
  product_url: assistedUrlSchema,
  founder_first_name: nullableText(80),
  business_email: businessEmailSchema,
  country_code: countryCodeSchema,
  source_url: assistedUrlSchema,
  source_context: requiredText(300),
  notes: nullableText(2000),
  source_attested: z.literal(true),
})

const mutableProspectFields = [
  'company_name',
  'product_name',
  'founder_first_name',
  'business_email',
  'country_code',
  'source_url',
  'source_context',
  'notes',
] as const

export const outreachProspectEditSchema = z.object({
  expected_revision: boundedRevisionSchema,
  source_attested: z.literal(true),
  company_name: requiredText(120).optional(),
  product_name: requiredText(120).optional(),
  founder_first_name: optionalNullableText(80),
  business_email: businessEmailSchema.optional(),
  country_code: optionalCountryCodeSchema,
  source_url: assistedUrlSchema.optional(),
  source_context: requiredText(300).optional(),
  notes: optionalNullableText(2000),
}).refine(
  value => mutableProspectFields.some(field => value[field] !== undefined),
)

const mutableDraftFields = ['subject_line', 'opening_line', 'email_body'] as const

export const outreachDraftEditSchema = z.object({
  expected_revision: boundedRevisionSchema,
  subject_line: requiredText(200).optional(),
  opening_line: requiredText(500).optional(),
  email_body: requiredText(5000).optional(),
}).refine(
  value => mutableDraftFields.some(field => value[field] !== undefined),
)

export const outreachApprovalSchema = z.object({
  expected_revision: boundedRevisionSchema,
  confirm_english_plain_text: z.literal(true),
  confirm_public_source: z.literal(true),
})

export const outreachSuppressionReasonSchema = requiredText(500)

export const outreachSuppressionSchema = z.object({
  prospect_public_id: canonicalUlidSchema,
  expected_revision: boundedRevisionSchema,
  target: z.enum(['email', 'product_domain', 'effective_domain']),
  reason: outreachSuppressionReasonSchema,
  source: z.enum(['manual', 'opt_out']),
  confirm: z.literal(true),
})

export const outreachExportSchema = z.object({
  campaign_key: campaignKeySchema,
  prospect_public_ids: z.array(canonicalUlidSchema)
    .min(1)
    .max(100)
    .refine(values => new Set(values).size === values.length),
  confirm_reexport: z.boolean(),
})

export type OutreachCampaignCreateInput = z.infer<typeof outreachCampaignCreateSchema>
export type OutreachCampaignUpdateInput = z.infer<typeof outreachCampaignUpdateSchema>
export type OutreachCandidateCreateInput = z.infer<typeof outreachCandidateCreateSchema>
export type OutreachProspectEditInput = z.infer<typeof outreachProspectEditSchema>
export type OutreachDraftEditInput = z.infer<typeof outreachDraftEditSchema>
export type OutreachApprovalInput = z.infer<typeof outreachApprovalSchema>
export type OutreachSuppressionInput = z.infer<typeof outreachSuppressionSchema>
export type OutreachExportInput = z.infer<typeof outreachExportSchema>
