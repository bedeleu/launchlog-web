import type { ZodType } from 'zod'
import {
  outreachApprovalSchema,
  outreachCampaignCreateSchema,
  outreachCampaignUpdateSchema,
  outreachCandidateCreateSchema,
  outreachDraftEditSchema,
  outreachExportSchema,
  outreachProspectEditSchema,
  outreachSuppressionSchema,
} from '../utils/outreach-form-schema'
import type {
  OutreachApprovalInput,
  OutreachCampaignCreateInput,
  OutreachCampaignUpdateInput,
  OutreachCandidateCreateInput,
  OutreachDraftEditInput,
  OutreachExportInput,
  OutreachProspectEditInput,
  OutreachSuppressionInput,
} from '../utils/outreach-form-schema'

const OUTREACH_PATH = '/api/v1/admin/outreach'
const MAX_INTEGER = 2_147_483_647
const CAMPAIGN_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CANONICAL_ULID = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/
const EFFECTIVE_STATUSES = new Set<OutreachEffectiveStatus>([
  'draft',
  'preview_generating',
  'ready_for_review',
  'approved',
  'exported',
  'failed',
  'expired',
  'suppressed',
  'converted',
])

export type OutreachCampaignStatus = 'draft' | 'active' | 'archived'
export type OutreachPersistedStatus = 'draft' | 'ready_for_review' | 'approved' | 'exported'
export type OutreachEffectiveStatus = 'draft' | 'preview_generating' | 'ready_for_review' | 'approved' | 'exported' | 'failed' | 'expired' | 'suppressed' | 'converted'
export type OutreachPreviewStatus = 'generating' | 'ready' | 'failed' | 'converted' | 'expired'
export type OutreachSuppressionKind = 'email' | 'domain'
export type OutreachSuppressionTarget = 'email' | 'product_domain' | 'effective_domain'
export type OutreachMatchedSuppressionTarget = OutreachSuppressionTarget | 'email_domain'
export type OutreachSuppressionSource = 'manual' | 'opt_out'

export interface OutreachCampaign {
  name: string
  key: string
  status: OutreachCampaignStatus
  sender_identity_label: string
  candidate_count: number
  created_at: string
  updated_at: string
}

export interface OutreachCandidateCampaign {
  name: string
  key: string
  status: OutreachCampaignStatus
  sender_identity_label: string
}

export interface OutreachActorSummary {
  name: string | null
  email: string | null
}

export interface OutreachProspectDetail {
  company_name: string
  product_name: string
  product_url: string
  normalized_domain: string
  founder_first_name: string | null
  business_email: string
  country_code: string | null
  source_url: string
  source_context: string
  notes: string | null
  source_attested_at: string
  source_attested_by: OutreachActorSummary
}

export interface OutreachManagedCapabilities {
  edit: false
  recapture: false
  checkout: boolean
}

export interface OutreachAdminPreview {
  status: OutreachPreviewStatus
  preview_url: string
  url: string
  normalized_domain: string | null
  title: string | null
  tagline: string | null
  description: string | null
  screenshot_url: string | null
  error: { code: string, message: string } | null
  expires_at: string | null
  capabilities: OutreachManagedCapabilities
}

export interface OutreachDraft {
  subject_line: string
  opening_line: string
  email_body: string
}

export type OutreachDraftValidationErrors = [] | Partial<Record<keyof OutreachDraft, string[]>>

export interface OutreachAudit {
  approved_at: string | null
  approved_by: OutreachActorSummary | null
  exported_at: string | null
  exported_by: OutreachActorSummary | null
  export_count: number
  last_export_hash: string | null
}

export interface OutreachSuppression {
  kind: OutreachSuppressionKind
  value: string
  reason: string
  source: OutreachSuppressionSource
  created_by: OutreachActorSummary | null
  created_at: string
  updated_at: string
}

export interface OutreachCandidateSuppression extends OutreachSuppression {
  matched_targets: OutreachMatchedSuppressionTarget[]
}

export interface OutreachCandidateDetail {
  public_id: string
  campaign: OutreachCandidateCampaign
  prospect: OutreachProspectDetail
  persisted_status: OutreachPersistedStatus
  effective_status: OutreachEffectiveStatus
  revision: number
  failure: { code: string, message: string } | null
  preview: OutreachAdminPreview | null
  draft: OutreachDraft | null
  validation_errors: OutreachDraftValidationErrors
  suppressions: OutreachCandidateSuppression[]
  audit: OutreachAudit
  created_at: string
  updated_at: string
}

export interface OutreachCandidateSummary {
  public_id: string
  campaign_key: string
  campaign_status: OutreachCampaignStatus
  company_name: string
  product_name: string
  product_url: string
  normalized_domain: string
  business_email_masked: string
  country_code: string | null
  persisted_status: OutreachPersistedStatus
  effective_status: OutreachEffectiveStatus
  preview_status: OutreachPreviewStatus | null
  expires_at: string | null
  revision: number
  failure_code: string | null
  approved_at: string | null
  exported_at: string | null
  export_count: number
  created_at: string
  updated_at: string
}

export interface OutreachPaginationLink {
  url: string | null
  label: string
  active: boolean
}

export interface OutreachPage<T> {
  data: T[]
  links: { first: string, last: string, prev: string | null, next: string | null }
  meta: {
    current_page: number
    from: number | null
    last_page: number
    links: OutreachPaginationLink[]
    path: string
    per_page: number
    to: number | null
    total: number
  }
}

export type OutreachCandidatePage = OutreachPage<OutreachCandidateSummary>
export type OutreachSuppressionPage = OutreachPage<OutreachSuppression>

export interface OutreachCommittedRecovery {
  public_id: string
  persistence_status: 'committed'
  recovery_url: string
}

export type OutreachCandidateMutationResult = OutreachCandidateDetail | OutreachCommittedRecovery

export interface OutreachTransportOptions {
  signal?: AbortSignal
}

export interface OutreachCandidateFilters {
  status?: OutreachEffectiveStatus
  campaign_key?: string
  domain?: string
  suppressed?: boolean
  page?: number
}

export interface OutreachSuppressionFilters {
  page?: number
}

export interface OutreachExportResult {
  blob: Blob
  filename: string
}

export interface AdminOutreachClient {
  listCampaigns: (transport?: OutreachTransportOptions) => Promise<OutreachCampaign[]>
  createCampaign: (payload: OutreachCampaignCreateInput, transport?: OutreachTransportOptions) => Promise<OutreachCampaign>
  updateCampaign: (key: string, payload: OutreachCampaignUpdateInput, transport?: OutreachTransportOptions) => Promise<OutreachCampaign>
  listCandidates: (filters?: OutreachCandidateFilters, transport?: OutreachTransportOptions) => Promise<OutreachCandidatePage>
  createCandidate: (payload: OutreachCandidateCreateInput, transport?: OutreachTransportOptions) => Promise<OutreachCandidateMutationResult>
  getCandidate: (publicId: string, transport?: OutreachTransportOptions) => Promise<OutreachCandidateDetail>
  updateProspect: (publicId: string, payload: OutreachProspectEditInput, transport?: OutreachTransportOptions) => Promise<OutreachCandidateMutationResult>
  updateDraft: (publicId: string, payload: OutreachDraftEditInput, transport?: OutreachTransportOptions) => Promise<OutreachCandidateMutationResult>
  approveCandidate: (publicId: string, payload: OutreachApprovalInput, transport?: OutreachTransportOptions) => Promise<OutreachCandidateMutationResult>
  recaptureCandidate: (publicId: string, transport?: OutreachTransportOptions) => Promise<OutreachCandidateMutationResult>
  renewCandidate: (publicId: string, transport?: OutreachTransportOptions) => Promise<OutreachCandidateMutationResult>
  listSuppressions: (filters?: OutreachSuppressionFilters, transport?: OutreachTransportOptions) => Promise<OutreachSuppressionPage>
  createSuppression: (payload: OutreachSuppressionInput, transport?: OutreachTransportOptions) => Promise<OutreachSuppression>
  exportCandidates: (payload: OutreachExportInput, transport?: OutreachTransportOptions) => Promise<OutreachExportResult>
}

export type OutreachApiErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'stale_revision'
  | 'conflict'
  | 'validation'
  | 'rate_limited'
  | 'server'
  | 'aborted'
  | 'network'

const ERROR_MESSAGES: Record<OutreachApiErrorKind, string> = {
  unauthenticated: 'Sign in again to continue.',
  forbidden: 'You do not have permission to do that.',
  not_found: 'This outreach record was not found.',
  stale_revision: 'This candidate changed. Reload and review it again.',
  conflict: 'This action conflicts with the current candidate state.',
  validation: 'Check the highlighted fields.',
  rate_limited: 'Too many requests. Wait and try again.',
  server: 'LaunchLog could not complete this request.',
  aborted: 'The request was cancelled.',
  network: 'Could not reach LaunchLog. Check your connection and try again.',
}

const VALIDATION_FIELDS = [
  'name',
  'key',
  'status',
  'sender_identity_label',
  'campaign_key',
  'company_name',
  'product_name',
  'product_url',
  'founder_first_name',
  'business_email',
  'country_code',
  'source_url',
  'source_context',
  'notes',
  'source_attested',
  'expected_revision',
  'subject_line',
  'opening_line',
  'email_body',
  'confirm_english_plain_text',
  'confirm_public_source',
  'prospect_public_id',
  'target',
  'reason',
  'source',
  'confirm',
  'prospect_public_ids',
  'confirm_reexport',
  'domain',
  'suppressed',
  'page',
] as const

export class OutreachApiError extends Error {
  readonly kind: OutreachApiErrorKind
  readonly status: number | null
  readonly fieldErrors: Record<string, string[]>

  constructor(kind: OutreachApiErrorKind, status: number | null = null, fieldErrors: Record<string, string[]> = {}) {
    super(ERROR_MESSAGES[kind])
    this.name = 'OutreachApiError'
    this.kind = kind
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numericStatus(error: Record<string, unknown>): number | null {
  for (const value of [error.status, error.statusCode]) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  if (isRecord(error.response)) {
    const status = error.response.status
    if (typeof status === 'number' && Number.isFinite(status)) return status
  }
  return null
}

function errorData(error: Record<string, unknown>): Record<string, unknown> | null {
  if (isRecord(error.data)) return error.data
  if (!isRecord(error.response)) return null
  if (isRecord(error.response._data)) return error.response._data
  if (isRecord(error.response.data)) return error.response.data
  return null
}

function validationFieldErrors(data: Record<string, unknown> | null): Record<string, string[]> {
  if (data === null || !isRecord(data.errors)) return {}
  const source = data.errors
  const result: Record<string, string[]> = {}
  const orderedFields = [
    ...VALIDATION_FIELDS,
    ...Array.from({ length: 100 }, (_, index) => `prospect_public_ids.${index}`),
  ]

  for (const field of orderedFields) {
    if (Object.keys(result).length >= 32) break
    const messages = source[field]
    if (Array.isArray(messages) && messages.some(message => typeof message === 'string')) {
      result[field] = ['Check this field.']
    }
  }
  return result
}

export function mapOutreachApiError(error: unknown): OutreachApiError {
  if (error instanceof OutreachApiError) return error
  if (isRecord(error) && error.name === 'AbortError') return new OutreachApiError('aborted')

  if (!isRecord(error)) return new OutreachApiError('network')
  const status = numericStatus(error)
  const data = errorData(error)
  if (status === null) return new OutreachApiError('network')
  if (status === 401) return new OutreachApiError('unauthenticated', status)
  if (status === 403) return new OutreachApiError('forbidden', status)
  if (status === 404) return new OutreachApiError('not_found', status)
  if (status === 409) {
    return new OutreachApiError(
      data?.message === ERROR_MESSAGES.stale_revision ? 'stale_revision' : 'conflict',
      status,
    )
  }
  if (status === 422) return new OutreachApiError('validation', status, validationFieldErrors(data))
  if (status === 429) return new OutreachApiError('rate_limited', status)
  return new OutreachApiError('server', status)
}

function localValidationError(): OutreachApiError {
  return new OutreachApiError('validation')
}

function parseLocal<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw localValidationError()
  return result.data
}

function isCanonicalUlid(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_ULID.test(value)
}

function isCampaignKey(value: unknown): value is string {
  return typeof value === 'string'
    && Array.from(value).length <= 80
    && CAMPAIGN_KEY.test(value)
}

function isPage(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_INTEGER
}

export function validateCommittedRecovery(result: OutreachCommittedRecovery, expectedPublicId?: string): string {
  if (!isRecord(result) || result.persistence_status !== 'committed' || !isCanonicalUlid(result.public_id)) {
    throw new OutreachApiError('server')
  }
  if (expectedPublicId !== undefined && (!isCanonicalUlid(expectedPublicId) || result.public_id !== expectedPublicId)) {
    throw new OutreachApiError('server')
  }
  if (result.recovery_url !== `${OUTREACH_PATH}/candidates/${result.public_id}`) {
    throw new OutreachApiError('server')
  }
  return result.public_id
}

export interface OutreachFetchOptions {
  method?: string
  headers?: Record<string, string>
  body?: Record<string, unknown>
  query?: Record<string, unknown>
  signal?: AbortSignal
  retry?: number
}

export interface OutreachRawResponse {
  _data: string
  headers: { get: (name: string) => string | null }
}

export type OutreachFetch = ((url: string, options?: OutreachFetchOptions) => Promise<unknown>) & {
  raw: (url: string, options?: OutreachFetchOptions) => Promise<OutreachRawResponse>
}

export interface AdminOutreachClientDependencies {
  apiBase: string
  getIdToken: () => Promise<string | null>
  fetch: OutreachFetch
}

function resourceData<T>(value: unknown): T {
  if (!isRecord(value) || !('data' in value)) throw new OutreachApiError('server')
  return value.data as T
}

export function createAdminOutreachClient(deps: AdminOutreachClientDependencies): AdminOutreachClient {
  const base = `${deps.apiBase.replace(/\/+$/, '')}${OUTREACH_PATH}`

  const requestOptions = async (
    method: string,
    transport?: OutreachTransportOptions,
    body?: Record<string, unknown>,
    query?: Record<string, unknown>,
  ): Promise<OutreachFetchOptions> => {
    let token: string | null
    try {
      token = await deps.getIdToken()
    }
    catch (error) {
      throw mapOutreachApiError(error)
    }
    if (!token) throw new OutreachApiError('unauthenticated')

    return {
      method,
      headers: { Authorization: `Bearer ${token}` },
      ...(body === undefined ? {} : { body }),
      ...(query === undefined ? {} : { query }),
      signal: transport?.signal,
      retry: 0,
    }
  }

  const json = async <T>(
    path: string,
    method: string,
    transport?: OutreachTransportOptions,
    body?: Record<string, unknown>,
    query?: Record<string, unknown>,
  ): Promise<T> => {
    const options = await requestOptions(method, transport, body, query)
    try {
      return await deps.fetch(`${base}${path}`, options) as T
    }
    catch (error) {
      throw mapOutreachApiError(error)
    }
  }

  const listCampaigns = async (transport?: OutreachTransportOptions): Promise<OutreachCampaign[]> => {
    return resourceData(await json<unknown>('/campaigns', 'GET', transport))
  }

  const createCampaign = async (payload: OutreachCampaignCreateInput, transport?: OutreachTransportOptions): Promise<OutreachCampaign> => {
    const body = parseLocal(outreachCampaignCreateSchema, payload)
    return resourceData(await json<unknown>('/campaigns', 'POST', transport, body))
  }

  const updateCampaign = async (key: string, payload: OutreachCampaignUpdateInput, transport?: OutreachTransportOptions): Promise<OutreachCampaign> => {
    if (!isCampaignKey(key)) throw localValidationError()
    const body = parseLocal(outreachCampaignUpdateSchema, payload)
    return resourceData(await json<unknown>(`/campaigns/${encodeURIComponent(key)}`, 'PATCH', transport, body))
  }

  const listCandidates = async (filters: OutreachCandidateFilters = {}, transport?: OutreachTransportOptions): Promise<OutreachCandidatePage> => {
    const rawFilters: Record<string, unknown> = isRecord(filters) ? filters : {}
    const query: Record<string, unknown> = {}
    if (rawFilters.status !== undefined) {
      if (typeof rawFilters.status !== 'string' || !EFFECTIVE_STATUSES.has(rawFilters.status as OutreachEffectiveStatus)) {
        throw localValidationError()
      }
      query.status = rawFilters.status
    }
    if (rawFilters.campaign_key !== undefined) {
      if (!isCampaignKey(rawFilters.campaign_key)) throw localValidationError()
      query.campaign_key = rawFilters.campaign_key
    }
    if (rawFilters.domain !== undefined) {
      if (typeof rawFilters.domain !== 'string') throw localValidationError()
      const domain = rawFilters.domain.trim().toLowerCase().replace(/\.+$/, '')
      if (Array.from(domain).length > 253) throw localValidationError()
      if (domain !== '') query.domain = domain
    }
    if (rawFilters.suppressed !== undefined) {
      if (typeof rawFilters.suppressed !== 'boolean') throw localValidationError()
      query.suppressed = rawFilters.suppressed ? 1 : 0
    }
    if (rawFilters.page !== undefined) {
      if (!isPage(rawFilters.page)) throw localValidationError()
      query.page = rawFilters.page
    }
    return await json<OutreachCandidatePage>('/candidates', 'GET', transport, undefined, Object.keys(query).length === 0 ? undefined : query)
  }

  const createCandidate = async (payload: OutreachCandidateCreateInput, transport?: OutreachTransportOptions): Promise<OutreachCandidateMutationResult> => {
    const body = parseLocal(outreachCandidateCreateSchema, payload)
    return resourceData(await json<unknown>('/candidates', 'POST', transport, body))
  }

  const getCandidate = async (publicId: string, transport?: OutreachTransportOptions): Promise<OutreachCandidateDetail> => {
    if (!isCanonicalUlid(publicId)) throw localValidationError()
    return resourceData(await json<unknown>(`/candidates/${encodeURIComponent(publicId)}`, 'GET', transport))
  }

  const updateProspect = async (publicId: string, payload: OutreachProspectEditInput, transport?: OutreachTransportOptions): Promise<OutreachCandidateMutationResult> => {
    if (!isCanonicalUlid(publicId)) throw localValidationError()
    const body = parseLocal(outreachProspectEditSchema, payload)
    return resourceData(await json<unknown>(`/candidates/${encodeURIComponent(publicId)}/prospect`, 'PATCH', transport, body))
  }

  const updateDraft = async (publicId: string, payload: OutreachDraftEditInput, transport?: OutreachTransportOptions): Promise<OutreachCandidateMutationResult> => {
    if (!isCanonicalUlid(publicId)) throw localValidationError()
    const body = parseLocal(outreachDraftEditSchema, payload)
    return resourceData(await json<unknown>(`/candidates/${encodeURIComponent(publicId)}/draft`, 'PATCH', transport, body))
  }

  const approveCandidate = async (publicId: string, payload: OutreachApprovalInput, transport?: OutreachTransportOptions): Promise<OutreachCandidateMutationResult> => {
    if (!isCanonicalUlid(publicId)) throw localValidationError()
    const body = parseLocal(outreachApprovalSchema, payload)
    return resourceData(await json<unknown>(`/candidates/${encodeURIComponent(publicId)}/approve`, 'POST', transport, body))
  }

  const recaptureCandidate = async (publicId: string, transport?: OutreachTransportOptions): Promise<OutreachCandidateMutationResult> => {
    if (!isCanonicalUlid(publicId)) throw localValidationError()
    return resourceData(await json<unknown>(`/candidates/${encodeURIComponent(publicId)}/recapture`, 'POST', transport, {}))
  }

  const renewCandidate = async (publicId: string, transport?: OutreachTransportOptions): Promise<OutreachCandidateMutationResult> => {
    if (!isCanonicalUlid(publicId)) throw localValidationError()
    return resourceData(await json<unknown>(`/candidates/${encodeURIComponent(publicId)}/renew`, 'POST', transport, {}))
  }

  const listSuppressions = async (filters: OutreachSuppressionFilters = {}, transport?: OutreachTransportOptions): Promise<OutreachSuppressionPage> => {
    const rawFilters: Record<string, unknown> = isRecord(filters) ? filters : {}
    let query: Record<string, unknown> | undefined
    if (rawFilters.page !== undefined) {
      if (!isPage(rawFilters.page)) throw localValidationError()
      query = { page: rawFilters.page }
    }
    return await json<OutreachSuppressionPage>('/suppressions', 'GET', transport, undefined, query)
  }

  const createSuppression = async (payload: OutreachSuppressionInput, transport?: OutreachTransportOptions): Promise<OutreachSuppression> => {
    const body = parseLocal(outreachSuppressionSchema, payload)
    return resourceData(await json<unknown>('/suppressions', 'POST', transport, body))
  }

  const exportCandidates = async (payload: OutreachExportInput, transport?: OutreachTransportOptions): Promise<OutreachExportResult> => {
    const body = parseLocal(outreachExportSchema, payload)
    const fallbackFilename = `launchlog-outreach-${body.campaign_key}.csv`
    const options = await requestOptions('POST', transport, body)
    try {
      const response = await deps.fetch.raw(`${base}/exports`, options)
      if (typeof response._data !== 'string' || !isRecord(response.headers) || typeof response.headers.get !== 'function') {
        throw new OutreachApiError('server')
      }
      const contentDisposition = response.headers.get('content-disposition')
      let filename = fallbackFilename
      if (typeof contentDisposition === 'string' && /^[\x20-\x7e]+$/.test(contentDisposition)) {
        const match = /^attachment;\s*filename="([\x20-\x7e]+)"\s*$/.exec(contentDisposition)
        if (match?.[1] === fallbackFilename) filename = match[1]
      }
      const blob = new Blob([response._data], { type: 'text/csv;charset=UTF-8' })
      if (blob.type !== 'text/csv;charset=UTF-8') {
        Object.defineProperty(blob, 'type', { value: 'text/csv;charset=UTF-8' })
      }
      return {
        blob,
        filename,
      }
    }
    catch (error) {
      throw mapOutreachApiError(error)
    }
  }

  return {
    listCampaigns,
    createCampaign,
    updateCampaign,
    listCandidates,
    createCandidate,
    getCandidate,
    updateProspect,
    updateDraft,
    approveCandidate,
    recaptureCandidate,
    renewCandidate,
    listSuppressions,
    createSuppression,
    exportCandidates,
  }
}

export function useAdminOutreach(): AdminOutreachClient {
  const config = useRuntimeConfig()
  const { getIdToken } = useAuth()
  return createAdminOutreachClient({
    apiBase: config.public.apiUrl,
    getIdToken,
    fetch: $fetch as unknown as OutreachFetch,
  })
}
