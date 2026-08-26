import { beforeEach, describe, expect, test } from 'bun:test'

type CampaignStatus = 'draft' | 'active' | 'archived'
type PersistedStatus = 'draft' | 'ready_for_review' | 'approved' | 'exported'
type EffectiveStatus = 'draft' | 'preview_generating' | 'ready_for_review' | 'approved' | 'exported' | 'failed' | 'expired' | 'suppressed' | 'converted'

interface Campaign {
  name: string
  key: string
  status: CampaignStatus
  sender_identity_label: string
  candidate_count: number
  created_at: string
  updated_at: string
}

interface Actor {
  name: string | null
  email: string | null
}

interface CandidateDetail {
  public_id: string
  campaign: {
    name: string
    key: string
    status: CampaignStatus
    sender_identity_label: string
  }
  prospect: {
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
    source_attested_by: Actor
  }
  persisted_status: PersistedStatus
  effective_status: EffectiveStatus
  revision: number
  failure: { code: string, message: string } | null
  preview: {
    status: 'generating' | 'ready' | 'failed' | 'converted' | 'expired'
    preview_url: string
    url: string
    normalized_domain: string | null
    title: string | null
    tagline: string | null
    description: string | null
    screenshot_url: string | null
    error: { code: string, message: string } | null
    expires_at: string | null
    capabilities: { edit: false, recapture: false, checkout: boolean }
  } | null
  draft: { subject_line: string, opening_line: string, email_body: string } | null
  validation_errors: [] | Partial<Record<'subject_line' | 'opening_line' | 'email_body', string[]>>
  suppressions: Array<Suppression & {
    matched_targets: Array<'email' | 'product_domain' | 'effective_domain' | 'email_domain'>
  }>
  audit: {
    approved_at: string | null
    approved_by: Actor | null
    exported_at: string | null
    exported_by: Actor | null
    export_count: number
    last_export_hash: string | null
  }
  created_at: string
  updated_at: string
}

interface CandidateSummary {
  public_id: string
  campaign_key: string
  campaign_status: CampaignStatus
  company_name: string
  product_name: string
  product_url: string
  normalized_domain: string
  business_email_masked: string
  country_code: string | null
  persisted_status: PersistedStatus
  effective_status: EffectiveStatus
  preview_status: 'generating' | 'ready' | 'failed' | 'converted' | 'expired' | null
  expires_at: string | null
  revision: number
  failure_code: string | null
  approved_at: string | null
  exported_at: string | null
  export_count: number
  created_at: string
  updated_at: string
}

interface Suppression {
  kind: 'email' | 'domain'
  value: string
  reason: string
  source: 'manual' | 'opt_out'
  created_by: Actor | null
  created_at: string
  updated_at: string
}

interface Page<T> {
  data: T[]
  links: { first: string, last: string, prev: string | null, next: string | null }
  meta: {
    current_page: number
    from: number | null
    last_page: number
    links: Array<{ url: string | null, label: string, active: boolean }>
    path: string
    per_page: number
    to: number | null
    total: number
  }
}

interface CommittedRecovery {
  public_id: string
  persistence_status: 'committed'
  recovery_url: string
}

interface TransportOptions {
  signal?: AbortSignal
}

interface OutreachClient {
  listCampaigns: (transport?: TransportOptions) => Promise<Campaign[]>
  createCampaign: (payload: Record<string, unknown>, transport?: TransportOptions) => Promise<Campaign>
  updateCampaign: (key: unknown, payload: Record<string, unknown>, transport?: TransportOptions) => Promise<Campaign>
  listCandidates: (filters?: Record<string, unknown>, transport?: TransportOptions) => Promise<Page<CandidateSummary>>
  createCandidate: (payload: Record<string, unknown>, transport?: TransportOptions) => Promise<CandidateDetail | CommittedRecovery>
  getCandidate: (publicId: unknown, transport?: TransportOptions) => Promise<CandidateDetail>
  updateProspect: (publicId: unknown, payload: Record<string, unknown>, transport?: TransportOptions) => Promise<CandidateDetail | CommittedRecovery>
  updateDraft: (publicId: unknown, payload: Record<string, unknown>, transport?: TransportOptions) => Promise<CandidateDetail | CommittedRecovery>
  approveCandidate: (publicId: unknown, payload: Record<string, unknown>, transport?: TransportOptions) => Promise<CandidateDetail | CommittedRecovery>
  recaptureCandidate: (publicId: unknown, transport?: TransportOptions) => Promise<CandidateDetail | CommittedRecovery>
  renewCandidate: (publicId: unknown, transport?: TransportOptions) => Promise<CandidateDetail | CommittedRecovery>
  listSuppressions: (filters?: Record<string, unknown>, transport?: TransportOptions) => Promise<Page<Suppression>>
  createSuppression: (payload: Record<string, unknown>, transport?: TransportOptions) => Promise<Suppression>
  exportCandidates: (payload: Record<string, unknown>, transport?: TransportOptions) => Promise<{ blob: Blob, filename: string }>
}

interface FetchOptions {
  method?: string
  headers?: Record<string, string>
  body?: Record<string, unknown>
  query?: Record<string, unknown>
  signal?: AbortSignal
  retry?: number
}

interface RawResponse {
  _data: string
  headers: { get: (name: string) => string | null }
}

type FetchLike = ((url: string, options?: FetchOptions) => Promise<unknown>) & {
  raw: (url: string, options?: FetchOptions) => Promise<RawResponse>
}

interface OutreachApiErrorContract extends Error {
  kind: 'unauthenticated' | 'forbidden' | 'not_found' | 'stale_revision' | 'conflict' | 'validation' | 'rate_limited' | 'server' | 'aborted' | 'network'
  status: number | null
  fieldErrors: Record<string, string[]>
}

interface AdminOutreachModule {
  OutreachApiError: { new (...args: never[]): OutreachApiErrorContract }
  createAdminOutreachClient: (deps: {
    apiBase: string
    getIdToken: () => Promise<string | null>
    fetch: FetchLike
  }) => OutreachClient
  mapOutreachApiError: (error: unknown) => OutreachApiErrorContract
  validateCommittedRecovery: (result: CommittedRecovery, expectedPublicId?: string) => string
  useAdminOutreach: () => OutreachClient
}

interface FetchCall {
  url: string
  options: FetchOptions | undefined
  raw: boolean
}

type QueuedJson =
  | { kind: 'resolve', value: unknown }
  | { kind: 'reject', error: unknown }

type QueuedRaw =
  | { kind: 'resolve', value: RawResponse }
  | { kind: 'reject', error: unknown }

const modulePath = ['./useAdminOutreach', 'ts'].join('.')
const externalGlobalGuards = [
  'fetch',
  '$fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'navigator',
  'sendBeacon',
  'document',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'caches',
  'cookieStore',
  'useRuntimeConfig',
  'useNuxtApp',
  'useAuth',
  'useFirebaseAuth',
  'getAuth',
  'firebase',
  'firebaseAuth',
  'provider',
]
const importDescriptors = new Map<string, PropertyDescriptor | undefined>()
const forbiddenImportSideEffect = (): never => {
  throw new Error('Outreach module import touched a forbidden browser or network surface.')
}
let importedModule: unknown

for (const name of externalGlobalGuards) {
  importDescriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, name, { get: forbiddenImportSideEffect, configurable: true })
}

const importCreateObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
const importRevokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
Object.defineProperty(URL, 'createObjectURL', { value: forbiddenImportSideEffect, configurable: true })
Object.defineProperty(URL, 'revokeObjectURL', { value: forbiddenImportSideEffect, configurable: true })

try {
  importedModule = await import(modulePath)
}
finally {
  for (const name of externalGlobalGuards) {
    const descriptor = importDescriptors.get(name)
    if (descriptor === undefined) Reflect.deleteProperty(globalThis, name)
    else Object.defineProperty(globalThis, name, descriptor)
  }
  if (importCreateObjectUrlDescriptor !== undefined) {
    Object.defineProperty(URL, 'createObjectURL', importCreateObjectUrlDescriptor)
  }
  else {
    Reflect.deleteProperty(URL, 'createObjectURL')
  }
  if (importRevokeObjectUrlDescriptor !== undefined) {
    Object.defineProperty(URL, 'revokeObjectURL', importRevokeObjectUrlDescriptor)
  }
  else {
    Reflect.deleteProperty(URL, 'revokeObjectURL')
  }
}

const subject = importedModule as AdminOutreachModule

const API = 'https://api.launchlog.test'
const TOKEN = 'firebase-id-token'
const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const SECOND_ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAW'
const MAX_INTEGER = 2_147_483_647

function installExternalSideEffectGuards(): () => void {
  const descriptors = new Map<string, PropertyDescriptor | undefined>()
  const fail = (): never => {
    throw new Error('Outreach client touched a forbidden network, storage, DOM, beacon, or provider surface.')
  }

  for (const name of externalGlobalGuards) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { get: fail, configurable: true })
  }

  const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
  Object.defineProperty(URL, 'createObjectURL', { value: fail, configurable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: fail, configurable: true })

  return () => {
    for (const name of externalGlobalGuards) {
      const descriptor = descriptors.get(name)
      if (descriptor === undefined) Reflect.deleteProperty(globalThis, name)
      else Object.defineProperty(globalThis, name, descriptor)
    }
    if (createObjectUrlDescriptor === undefined) Reflect.deleteProperty(URL, 'createObjectURL')
    else Object.defineProperty(URL, 'createObjectURL', createObjectUrlDescriptor)
    if (revokeObjectUrlDescriptor === undefined) Reflect.deleteProperty(URL, 'revokeObjectURL')
    else Object.defineProperty(URL, 'revokeObjectURL', revokeObjectUrlDescriptor)
  }
}

const campaign: Campaign = {
  name: 'Founders 2026',
  key: 'founders-2026',
  status: 'draft',
  sender_identity_label: 'Warmed founder domain',
  candidate_count: 1,
  created_at: '2026-08-25T10:00:00.000Z',
  updated_at: '2026-08-26T10:00:00.000Z',
}

const suppression: Suppression = {
  kind: 'email',
  value: 'ada@acme.test',
  reason: 'Requested opt out',
  source: 'opt_out',
  created_by: { name: 'Admin', email: 'admin@launchlog.ai' },
  created_at: '2026-08-26T09:00:00.000Z',
  updated_at: '2026-08-26T09:00:00.000Z',
}

const detail: CandidateDetail = {
  public_id: ULID,
  campaign: {
    name: campaign.name,
    key: campaign.key,
    status: campaign.status,
    sender_identity_label: campaign.sender_identity_label,
  },
  prospect: {
    company_name: 'Acme Labs',
    product_name: 'Acme Launch',
    product_url: 'https://acme.test/product',
    normalized_domain: 'acme.test',
    founder_first_name: 'Ada',
    business_email: 'ada@acme.test',
    country_code: 'US',
    source_url: 'https://directory.test/acme',
    source_context: 'Public founder profile.',
    notes: null,
    source_attested_at: '2026-08-25T10:00:00.000Z',
    source_attested_by: { name: 'Admin', email: 'admin@launchlog.ai' },
  },
  persisted_status: 'ready_for_review',
  effective_status: 'ready_for_review',
  revision: 7,
  failure: null,
  preview: {
    status: 'ready',
    preview_url: 'https://launchlog.ai/preview/private-token',
    url: 'https://acme.test/product',
    normalized_domain: 'acme.test',
    title: 'Acme Launch',
    tagline: 'Ship clearly',
    description: 'A focused launch tool.',
    screenshot_url: 'https://cdn.launchlog.ai/acme.png',
    error: null,
    expires_at: '2026-08-30T10:00:00.000Z',
    capabilities: { edit: false, recapture: false, checkout: true },
  },
  draft: {
    subject_line: 'A private preview for Acme',
    opening_line: 'Hi Ada, I found Acme in a public directory.',
    email_body: 'I prepared a private LaunchLog preview for your review.',
  },
  validation_errors: [],
  suppressions: [{
    ...suppression,
    matched_targets: ['email', 'email_domain'],
  }],
  audit: {
    approved_at: null,
    approved_by: null,
    exported_at: null,
    exported_by: null,
    export_count: 0,
    last_export_hash: null,
  },
  created_at: '2026-08-25T10:00:00.000Z',
  updated_at: '2026-08-26T10:00:00.000Z',
}

const summary: CandidateSummary = {
  public_id: ULID,
  campaign_key: campaign.key,
  campaign_status: campaign.status,
  company_name: detail.prospect.company_name,
  product_name: detail.prospect.product_name,
  product_url: detail.prospect.product_url,
  normalized_domain: detail.prospect.normalized_domain,
  business_email_masked: 'a***@acme.test',
  country_code: 'US',
  persisted_status: detail.persisted_status,
  effective_status: detail.effective_status,
  preview_status: 'ready',
  expires_at: detail.preview?.expires_at ?? null,
  revision: detail.revision,
  failure_code: null,
  approved_at: null,
  exported_at: null,
  export_count: 0,
  created_at: detail.created_at,
  updated_at: detail.updated_at,
}

const candidatePage: Page<CandidateSummary> = {
  data: [summary],
  links: {
    first: `${API}/api/v1/admin/outreach/candidates?page=1`,
    last: `${API}/api/v1/admin/outreach/candidates?page=2`,
    prev: null,
    next: `${API}/api/v1/admin/outreach/candidates?page=2`,
  },
  meta: {
    current_page: 1,
    from: 1,
    last_page: 2,
    links: [
      { url: null, label: '&laquo; Previous', active: false },
      { url: `${API}/api/v1/admin/outreach/candidates?page=1`, label: '1', active: true },
    ],
    path: `${API}/api/v1/admin/outreach/candidates`,
    per_page: 30,
    to: 1,
    total: 31,
  },
}

const suppressionPage: Page<Suppression> = {
  data: [suppression],
  links: {
    first: `${API}/api/v1/admin/outreach/suppressions?page=1`,
    last: `${API}/api/v1/admin/outreach/suppressions?page=1`,
    prev: null,
    next: null,
  },
  meta: {
    current_page: 1,
    from: 1,
    last_page: 1,
    links: [{ url: null, label: '1', active: true }],
    path: `${API}/api/v1/admin/outreach/suppressions`,
    per_page: 30,
    to: 1,
    total: 1,
  },
}

const recovery: CommittedRecovery = {
  public_id: ULID,
  persistence_status: 'committed',
  recovery_url: `/api/v1/admin/outreach/candidates/${ULID}`,
}

let calls: FetchCall[]
let tokenCalls: number
let token: string | null
let jsonQueue: QueuedJson[]
let rawQueue: QueuedRaw[]
let fetcher: FetchLike
let client: OutreachClient

function nextJson(): QueuedJson {
  const next = jsonQueue.shift()
  if (next === undefined) {
    throw new Error('Unexpected JSON request in test.')
  }

  return next
}

function nextRaw(): QueuedRaw {
  const next = rawQueue.shift()
  if (next === undefined) {
    throw new Error('Unexpected raw request in test.')
  }

  return next
}

function queueJson(value: unknown): void {
  jsonQueue.push({ kind: 'resolve', value })
}

function rejectJson(error: unknown): void {
  jsonQueue.push({ kind: 'reject', error })
}

function rawResponse(data: string, contentDisposition: string | null = null): RawResponse {
  return {
    _data: data,
    headers: {
      get: name => name.toLowerCase() === 'content-disposition' ? contentDisposition : null,
    },
  }
}

function queueRaw(data: string, contentDisposition: string | null = null): void {
  rawQueue.push({ kind: 'resolve', value: rawResponse(data, contentDisposition) })
}

function rejectRaw(error: unknown): void {
  rawQueue.push({ kind: 'reject', error })
}

function makeFetcher(): FetchLike {
  return Object.assign(
    async (url: string, options?: FetchOptions): Promise<unknown> => {
      calls.push({ url, options, raw: false })
      const next = nextJson()
      if (next.kind === 'reject') {
        throw next.error
      }
      return next.value
    },
    {
      raw: async (url: string, options?: FetchOptions): Promise<RawResponse> => {
        calls.push({ url, options, raw: true })
        const next = nextRaw()
        if (next.kind === 'reject') {
          throw next.error
        }
        return next.value
      },
    },
  )
}

function createClient(getToken: () => Promise<string | null> = async () => {
  tokenCalls += 1
  return token
}): OutreachClient {
  return subject.createAdminOutreachClient({ apiBase: API, getIdToken: getToken, fetch: fetcher })
}

function uniqueUlids(count: number): string[] {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  const prefix = ULID.slice(0, 24)
  return Array.from({ length: count }, (_, index) => {
    const high = Math.floor(index / alphabet.length)
    const low = index % alphabet.length
    return `${prefix}${alphabet[high]}${alphabet[low]}`
  })
}

function ownReachableText(value: unknown, seen: Set<object> = new Set()): string {
  if (typeof value === 'string') return value
  if ((typeof value !== 'object' || value === null) && typeof value !== 'function') return ''
  if (seen.has(value)) return ''
  seen.add(value)

  let retained = ''
  for (const key of Reflect.ownKeys(value)) {
    retained += String(key)
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor !== undefined && 'value' in descriptor) {
      retained += ownReachableText(descriptor.value, seen)
    }
  }
  return retained
}

beforeEach(() => {
  calls = []
  tokenCalls = 0
  token = TOKEN
  jsonQueue = []
  rawQueue = []
  fetcher = makeFetcher()
  client = createClient()
})

describe('typed LaunchLog outreach requests', () => {
  test('expose only fourteen named operations and execute their exact wire contracts', async () => {
    const restoreExternalSurfaces = installExternalSideEffectGuards()
    try {
      client = createClient()
    const signal = new AbortController().signal
    queueJson({ data: [campaign] })
    queueJson({ data: campaign })
    queueJson({ data: { ...campaign, status: 'active' } })
    queueJson(candidatePage)
    queueJson({ data: recovery })
    queueJson({ data: detail })
    queueJson({ data: { ...detail, revision: 8 } })
    queueJson({ data: recovery })
    queueJson({ data: { ...detail, persisted_status: 'approved', effective_status: 'approved' } })
    queueJson({ data: { ...detail, effective_status: 'preview_generating' } })
    queueJson({ data: recovery })
    queueJson(suppressionPage)
    queueJson({ data: suppression })
    queueRaw('email,subject\r\nada@acme.test,Hello\r\n', 'attachment; filename="launchlog-outreach-founders-2026.csv"')

    expect(Object.keys(client).sort()).toEqual([
      'approveCandidate',
      'createCampaign',
      'createCandidate',
      'createSuppression',
      'exportCandidates',
      'getCandidate',
      'listCampaigns',
      'listCandidates',
      'listSuppressions',
      'recaptureCandidate',
      'renewCandidate',
      'updateCampaign',
      'updateDraft',
      'updateProspect',
    ])
    expect(Reflect.ownKeys(client).map(key => String(key)).sort()).toEqual(Object.keys(client).sort())
    expect(Object.getPrototypeOf(client)).toBe(Object.prototype)
    for (const forbiddenSurface of ['request', 'raw', 'fetch', 'fetchUrl', 'getUrl', 'postUrl', 'send', 'deliver', 'import']) {
      expect(forbiddenSurface in client).toBeFalse()
    }

    expect(await client.listCampaigns({ signal })).toEqual([campaign])
    expect(await client.createCampaign({
      name: campaign.name,
      key: campaign.key,
      sender_identity_label: campaign.sender_identity_label,
    }, { signal })).toEqual(campaign)
    expect(await client.updateCampaign(campaign.key, {
      name: 'Founders active',
      status: 'active',
      sender_identity_label: 'Warm domain B',
    }, { signal })).toEqual({ ...campaign, status: 'active' })
    expect(await client.listCandidates({
      status: 'failed',
      campaign_key: campaign.key,
      domain: '  ACME.TEST.  ',
      suppressed: false,
      page: 2,
    }, { signal })).toEqual(candidatePage)
    expect(await client.createCandidate({
      campaign_key: campaign.key,
      company_name: 'Acme Labs',
      product_name: 'Acme Launch',
      product_url: 'https://acme.test/product',
      founder_first_name: 'Ada',
      business_email: 'ada@acme.test',
      country_code: 'US',
      source_url: 'https://directory.test/acme',
      source_context: 'Public founder profile.',
      notes: null,
      source_attested: true,
    }, { signal })).toEqual(recovery)
    expect(await client.getCandidate(ULID, { signal })).toEqual(detail)
    expect(await client.updateProspect(ULID, {
      expected_revision: 7,
      company_name: 'Acme Labs updated',
      source_attested: true,
    }, { signal })).toEqual({ ...detail, revision: 8 })
    expect(await client.updateDraft(ULID, {
      expected_revision: 8,
      subject_line: 'Updated subject',
    }, { signal })).toEqual(recovery)
    expect(await client.approveCandidate(ULID, {
      expected_revision: 8,
      confirm_english_plain_text: true,
      confirm_public_source: true,
    }, { signal })).toEqual({ ...detail, persisted_status: 'approved', effective_status: 'approved' })
    expect(await client.recaptureCandidate(ULID, { signal })).toEqual({ ...detail, effective_status: 'preview_generating' })
    expect(await client.renewCandidate(ULID, { signal })).toEqual(recovery)
    expect(await client.listSuppressions({ page: 1 }, { signal })).toEqual(suppressionPage)
    expect(await client.createSuppression({
      prospect_public_id: ULID,
      expected_revision: 8,
      target: 'effective_domain',
      reason: 'Requested opt out',
      source: 'opt_out',
      confirm: true,
    }, { signal })).toEqual(suppression)
    const download = await client.exportCandidates({
      campaign_key: campaign.key,
      prospect_public_ids: [ULID],
      confirm_reexport: false,
    }, { signal })
    expect(download.filename).toBe('launchlog-outreach-founders-2026.csv')

    expect(tokenCalls).toBe(14)
    expect(calls).toHaveLength(14)
    expect(calls.map(call => [call.url, call.options?.method, call.raw])).toEqual([
      [`${API}/api/v1/admin/outreach/campaigns`, 'GET', false],
      [`${API}/api/v1/admin/outreach/campaigns`, 'POST', false],
      [`${API}/api/v1/admin/outreach/campaigns/founders-2026`, 'PATCH', false],
      [`${API}/api/v1/admin/outreach/candidates`, 'GET', false],
      [`${API}/api/v1/admin/outreach/candidates`, 'POST', false],
      [`${API}/api/v1/admin/outreach/candidates/${ULID}`, 'GET', false],
      [`${API}/api/v1/admin/outreach/candidates/${ULID}/prospect`, 'PATCH', false],
      [`${API}/api/v1/admin/outreach/candidates/${ULID}/draft`, 'PATCH', false],
      [`${API}/api/v1/admin/outreach/candidates/${ULID}/approve`, 'POST', false],
      [`${API}/api/v1/admin/outreach/candidates/${ULID}/recapture`, 'POST', false],
      [`${API}/api/v1/admin/outreach/candidates/${ULID}/renew`, 'POST', false],
      [`${API}/api/v1/admin/outreach/suppressions`, 'GET', false],
      [`${API}/api/v1/admin/outreach/suppressions`, 'POST', false],
      [`${API}/api/v1/admin/outreach/exports`, 'POST', true],
    ])

    for (const call of calls) {
      expect(call.url.startsWith(`${API}/api/v1/admin/outreach/`)).toBeTrue()
      expect(call.options?.headers).toEqual({ Authorization: `Bearer ${TOKEN}` })
      expect(call.options?.signal).toBe(signal)
      expect(call.options?.retry).toBe(0)
    }

    expect(calls[0]?.options?.body).toBeUndefined()
    expect(calls[0]?.options?.query).toBeUndefined()
    expect(calls[1]?.options?.body).toEqual({
      name: campaign.name,
      key: campaign.key,
      sender_identity_label: campaign.sender_identity_label,
    })
    expect(calls[2]?.options?.body).toEqual({
      name: 'Founders active',
      status: 'active',
      sender_identity_label: 'Warm domain B',
    })
    expect(calls[3]?.options?.query).toEqual({
      status: 'failed',
      campaign_key: campaign.key,
      domain: 'acme.test',
      suppressed: 0,
      page: 2,
    })
    expect(calls[4]?.options?.body).toEqual({
      campaign_key: campaign.key,
      company_name: 'Acme Labs',
      product_name: 'Acme Launch',
      product_url: 'https://acme.test/product',
      founder_first_name: 'Ada',
      business_email: 'ada@acme.test',
      country_code: 'US',
      source_url: 'https://directory.test/acme',
      source_context: 'Public founder profile.',
      notes: null,
      source_attested: true,
    })
    expect(calls[4]?.options?.query).toBeUndefined()
    expect(calls[5]?.options?.body).toBeUndefined()
    expect(calls[5]?.options?.query).toBeUndefined()
    expect(calls[6]?.options?.body).toEqual({
      expected_revision: 7,
      company_name: 'Acme Labs updated',
      source_attested: true,
    })
    expect(calls[6]?.options?.query).toBeUndefined()
    expect(calls[7]?.options?.body).toEqual({
      expected_revision: 8,
      subject_line: 'Updated subject',
    })
    expect(calls[7]?.options?.query).toBeUndefined()
    expect(calls[8]?.options?.body).toEqual({
      expected_revision: 8,
      confirm_english_plain_text: true,
      confirm_public_source: true,
    })
    expect(calls[8]?.options?.query).toBeUndefined()
    expect(calls[9]?.options?.body).toEqual({})
    expect(calls[9]?.options?.query).toBeUndefined()
    expect(calls[10]?.options?.body).toEqual({})
    expect(calls[10]?.options?.query).toBeUndefined()
    expect(calls[11]?.options?.query).toEqual({ page: 1 })
    expect(calls[11]?.options?.body).toBeUndefined()
    expect(calls[12]?.options?.body).toEqual({
      prospect_public_id: ULID,
      expected_revision: 8,
      target: 'effective_domain',
      reason: 'Requested opt out',
      source: 'opt_out',
      confirm: true,
    })
    expect(calls[13]?.options?.body).toEqual({
      campaign_key: campaign.key,
      prospect_public_ids: [ULID],
      confirm_reexport: false,
    })
    }
    finally {
      restoreExternalSurfaces()
    }
  })

  test('await a fresh token for every call and fail before fetch when missing', async () => {
    let sequence = 0
    const changingClient = createClient(async () => {
      sequence += 1
      return `token-${sequence}`
    })
    queueJson({ data: [campaign] })
    queueJson({ data: detail })

    await changingClient.listCampaigns()
    await changingClient.getCandidate(ULID)

    expect(calls[0]?.options?.headers).toEqual({ Authorization: 'Bearer token-1' })
    expect(calls[1]?.options?.headers).toEqual({ Authorization: 'Bearer token-2' })

    calls = []
    token = null
    await expect(client.listCampaigns()).rejects.toMatchObject({ kind: 'unauthenticated', status: null })
    expect(tokenCalls).toBe(1)
    expect(calls).toEqual([])
  })

  test('wire the Nuxt wrapper to runtime config, fresh auth, and the injected LaunchLog fetch only', async () => {
    const runtimeDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'useRuntimeConfig')
    const authDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'useAuth')
    const nuxtFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, '$fetch')
    let wrapperTokenCalls = 0
    Object.defineProperty(globalThis, 'useRuntimeConfig', {
      value: () => ({ public: { apiUrl: API } }),
      configurable: true,
    })
    Object.defineProperty(globalThis, 'useAuth', {
      value: () => ({
        getIdToken: async () => {
          wrapperTokenCalls += 1
          return `wrapper-token-${wrapperTokenCalls}`
        },
      }),
      configurable: true,
    })
    Object.defineProperty(globalThis, '$fetch', { value: fetcher, configurable: true })

    try {
      queueJson({ data: [campaign] })
      queueJson({ data: detail })
      const wrapper = subject.useAdminOutreach()
      expect(Object.keys(wrapper).sort()).toEqual(Object.keys(client).sort())
      expect(await wrapper.listCampaigns()).toEqual([campaign])
      expect(await wrapper.getCandidate(ULID)).toEqual(detail)
      expect(wrapperTokenCalls).toBe(2)
      expect(calls.map(call => call.options?.headers)).toEqual([
        { Authorization: 'Bearer wrapper-token-1' },
        { Authorization: 'Bearer wrapper-token-2' },
      ])
      expect(calls.every(call => call.url.startsWith(`${API}/api/v1/admin/outreach/`))).toBeTrue()
      expect(calls.every(call => call.options?.retry === 0)).toBeTrue()
    }
    finally {
      if (runtimeDescriptor === undefined) Reflect.deleteProperty(globalThis, 'useRuntimeConfig')
      else Object.defineProperty(globalThis, 'useRuntimeConfig', runtimeDescriptor)
      if (authDescriptor === undefined) Reflect.deleteProperty(globalThis, 'useAuth')
      else Object.defineProperty(globalThis, 'useAuth', authDescriptor)
      if (nuxtFetchDescriptor === undefined) Reflect.deleteProperty(globalThis, '$fetch')
      else Object.defineProperty(globalThis, '$fetch', nuxtFetchDescriptor)
    }
  })

  test('drop caller extras and keep sensitive fields body-only', async () => {
    queueJson({ data: recovery })
    queueJson({ data: detail })
    queueJson(candidatePage)
    queueJson({ data: suppression })
    queueJson({ data: campaign })
    queueJson({ data: { ...campaign, status: 'active' } })
    queueJson({ data: detail })
    queueJson({ data: detail })
    queueJson(suppressionPage)
    queueRaw('email,subject\r\n', null)

    const injectedCandidate = {
      campaign_key: campaign.key,
      company_name: 'Acme Labs',
      product_name: 'Acme Launch',
      product_url: 'https://acme.test/product',
      founder_first_name: 'Ada',
      business_email: 'ada@acme.test',
      country_code: 'US',
      source_url: 'https://directory.test/acme',
      source_context: 'Public profile.',
      notes: 'Review manually.',
      source_attested: true,
      token: 'forbidden-token',
      internal_id: 'forbidden-id',
      normalized_email_hash: 'forbidden-hash',
      unexpected: false,
    }
    await client.createCandidate(injectedCandidate)
    await client.updateProspect(ULID, {
      expected_revision: 7,
      source_attested: true,
      business_email: 'new@acme.test',
      product_url: 'https://must-not-change.test',
      campaign_key: 'must-not-change',
      public_id: SECOND_ULID,
      expected_revision_shadow: 99,
    })
    await client.listCandidates({
      status: 'failed',
      campaign_key: campaign.key,
      domain: '  ACME.TEST.. ',
      suppressed: true,
      page: 1,
      business_email: 'must-not-query@acme.test',
      source_url: 'https://must-not-query.test',
      q: 'must-not-query',
      token: 'must-not-query',
    })
    await client.createSuppression({
      prospect_public_id: ULID,
      expected_revision: 7,
      target: 'email',
      reason: 'Manual suppression',
      source: 'manual',
      confirm: true,
      value: 'raw@must-not-pass.test',
      kind: 'email',
      domain: 'must-not-pass.test',
    })
    await client.createCampaign({
      name: campaign.name,
      key: campaign.key,
      sender_identity_label: campaign.sender_identity_label,
      status: 'active',
      candidate_count: 999,
      token: 'must-not-pass',
    })
    await client.updateCampaign(campaign.key, {
      name: 'Updated campaign',
      status: 'active',
      sender_identity_label: 'Warm B',
      key: 'must-not-change',
      candidate_count: 999,
      created_at: 'must-not-pass',
    })
    await client.updateDraft(ULID, {
      expected_revision: 7,
      subject_line: 'Subject',
      opening_line: 'Opening',
      email_body: 'Body',
      business_email: 'must-not-pass@example.test',
      preview_url: 'https://must-not-pass.test',
      token: 'must-not-pass',
    })
    await client.approveCandidate(ULID, {
      expected_revision: 7,
      confirm_english_plain_text: true,
      confirm_public_source: true,
      status: 'exported',
      approved_by: 'must-not-pass',
      token: 'must-not-pass',
    })
    await client.listSuppressions({ page: 1, q: 'must-not-query', reason: 'must-not-query' })
    await client.exportCandidates({
      campaign_key: campaign.key,
      prospect_public_ids: [ULID],
      confirm_reexport: false,
      token: 'must-not-pass',
      provider_campaign_id: 'must-not-pass',
    })

    expect(calls[0]?.options?.body).toEqual({
      campaign_key: campaign.key,
      company_name: 'Acme Labs',
      product_name: 'Acme Launch',
      product_url: 'https://acme.test/product',
      founder_first_name: 'Ada',
      business_email: 'ada@acme.test',
      country_code: 'US',
      source_url: 'https://directory.test/acme',
      source_context: 'Public profile.',
      notes: 'Review manually.',
      source_attested: true,
    })
    expect(calls[1]?.options?.body).toEqual({
      expected_revision: 7,
      source_attested: true,
      business_email: 'new@acme.test',
    })
    expect(calls[2]?.options?.query).toEqual({
      status: 'failed',
      campaign_key: campaign.key,
      domain: 'acme.test',
      suppressed: 1,
      page: 1,
    })
    expect(calls[3]?.options?.body).toEqual({
      prospect_public_id: ULID,
      expected_revision: 7,
      target: 'email',
      reason: 'Manual suppression',
      source: 'manual',
      confirm: true,
    })
    expect(calls[4]?.options?.body).toEqual({
      name: campaign.name,
      key: campaign.key,
      sender_identity_label: campaign.sender_identity_label,
    })
    expect(calls[5]?.options?.body).toEqual({
      name: 'Updated campaign',
      status: 'active',
      sender_identity_label: 'Warm B',
    })
    expect(calls[6]?.options?.body).toEqual({
      expected_revision: 7,
      subject_line: 'Subject',
      opening_line: 'Opening',
      email_body: 'Body',
    })
    expect(calls[7]?.options?.body).toEqual({
      expected_revision: 7,
      confirm_english_plain_text: true,
      confirm_public_source: true,
    })
    expect(calls[8]?.options?.query).toEqual({ page: 1 })
    expect(calls[9]?.options?.body).toEqual({
      campaign_key: campaign.key,
      prospect_public_ids: [ULID],
      confirm_reexport: false,
    })
    expect(JSON.stringify(calls.map(call => call.options?.query))).not.toContain('ada@')
    expect(JSON.stringify(calls.map(call => call.options?.query))).not.toContain('source_url')
    expect(JSON.stringify(calls.map(call => call.options?.query))).not.toContain('token')
  })

  test('return both full and committed branches unchanged for create and every Task 8 mutation', async () => {
    const operations: Array<{
      path: string
      method: string
      invoke: () => Promise<CandidateDetail | CommittedRecovery>
    }> = [
      {
        path: '/api/v1/admin/outreach/candidates',
        method: 'POST',
        invoke: () => client.createCandidate({
          campaign_key: campaign.key,
          company_name: 'Acme Labs',
          product_name: 'Acme Launch',
          product_url: 'https://acme.test/product',
          founder_first_name: null,
          business_email: 'ada@acme.test',
          country_code: null,
          source_url: 'https://directory.test/acme',
          source_context: 'Public source.',
          notes: null,
          source_attested: true,
        }),
      },
      {
        path: `/api/v1/admin/outreach/candidates/${ULID}/prospect`,
        method: 'PATCH',
        invoke: () => client.updateProspect(ULID, {
          expected_revision: 7,
          source_attested: true,
          company_name: 'Acme Labs',
        }),
      },
      {
        path: `/api/v1/admin/outreach/candidates/${ULID}/draft`,
        method: 'PATCH',
        invoke: () => client.updateDraft(ULID, {
          expected_revision: 7,
          subject_line: 'Subject',
        }),
      },
      {
        path: `/api/v1/admin/outreach/candidates/${ULID}/approve`,
        method: 'POST',
        invoke: () => client.approveCandidate(ULID, {
          expected_revision: 7,
          confirm_english_plain_text: true,
          confirm_public_source: true,
        }),
      },
      {
        path: `/api/v1/admin/outreach/candidates/${ULID}/recapture`,
        method: 'POST',
        invoke: () => client.recaptureCandidate(ULID),
      },
      {
        path: `/api/v1/admin/outreach/candidates/${ULID}/renew`,
        method: 'POST',
        invoke: () => client.renewCandidate(ULID),
      },
    ]

    for (const operation of operations) {
      calls = []
      queueJson({ data: detail })
      queueJson({ data: recovery })
      expect(await operation.invoke()).toBe(detail)
      expect(await operation.invoke()).toBe(recovery)
      expect(calls).toHaveLength(2)
      expect(calls.map(call => call.url)).toEqual([
        `${API}${operation.path}`,
        `${API}${operation.path}`,
      ])
      expect(calls.map(call => call.options?.method)).toEqual([operation.method, operation.method])
      expect(calls.every(call => call.options?.retry === 0)).toBeTrue()
    }
  })

  test('reject invalid identifiers, filters, revisions, booleans, and selections before auth or fetch', async () => {
    const invalidCalls: Array<() => Promise<unknown>> = [
      () => client.getCandidate(ULID.toLowerCase()),
      () => client.getCandidate('01ARZ3NDEKTSV4RRFFQ69G5FAI'),
      () => client.getCandidate('81ARZ3NDEKTSV4RRFFQ69G5FAV'),
      () => client.createCampaign({ name: 'Campaign', key: 'Invalid_Key', sender_identity_label: 'Warm A' }),
      () => client.createCampaign({ name: 'Campaign', key: 'a'.repeat(81), sender_identity_label: 'Warm A' }),
      () => client.updateCampaign('Invalid_Key', { status: 'active' }),
      () => client.updateCampaign(campaign.key, {}),
      () => client.updateCampaign(campaign.key, { unknown: 'semantic-empty' }),
      () => client.updateProspect(ULID, { expected_revision: -1, source_attested: true, notes: null }),
      () => client.updateProspect(ULID, { expected_revision: 1.5, source_attested: true, notes: null }),
      () => client.updateProspect(ULID, { expected_revision: 1, source_attested: true }),
      () => client.updateProspect(ULID, { expected_revision: 1, source_attested: false, notes: null }),
      () => client.updateProspect(ULID.toLowerCase(), { expected_revision: 1, source_attested: true, notes: null }),
      () => client.updateDraft(ULID, { expected_revision: MAX_INTEGER + 1, subject_line: 'Subject' }),
      () => client.updateDraft(ULID, { expected_revision: 1 }),
      () => client.updateDraft(ULID.toLowerCase(), { expected_revision: 1, subject_line: 'Subject' }),
      () => client.approveCandidate(ULID, { expected_revision: 2, confirm_english_plain_text: false, confirm_public_source: true }),
      () => client.approveCandidate(ULID, { expected_revision: 2, confirm_english_plain_text: true, confirm_public_source: 1 }),
      () => client.approveCandidate(ULID.toLowerCase(), { expected_revision: 2, confirm_english_plain_text: true, confirm_public_source: true }),
      () => client.recaptureCandidate(ULID.toLowerCase()),
      () => client.renewCandidate(ULID.toLowerCase()),
      () => client.listCandidates({ status: 'sent' }),
      () => client.listCandidates({ status: 'Failed preview' }),
      () => client.listCandidates({ campaign_key: 'Invalid_Key' }),
      () => client.listCandidates({ domain: '😀'.repeat(254) }),
      () => client.listCandidates({ page: 0 }),
      () => client.listCandidates({ page: MAX_INTEGER + 1 }),
      () => client.listCandidates({ suppressed: 'false' }),
      () => client.listSuppressions({ page: 1.5 }),
      () => client.listSuppressions({ page: MAX_INTEGER + 1 }),
      () => client.createCandidate({ campaign_key: 'Invalid_Key', source_attested: true }),
      () => client.createCandidate({ campaign_key: campaign.key, source_attested: false }),
      () => client.createSuppression({ prospect_public_id: ULID, expected_revision: 1, target: 'raw_email', reason: 'Reason', source: 'manual', confirm: true }),
      () => client.createSuppression({ prospect_public_id: ULID.toLowerCase(), expected_revision: 1, target: 'email', reason: 'Reason', source: 'manual', confirm: true }),
      () => client.createSuppression({ prospect_public_id: ULID, expected_revision: -1, target: 'email', reason: 'Reason', source: 'manual', confirm: true }),
      () => client.createSuppression({ prospect_public_id: ULID, expected_revision: 1, target: 'email', reason: 'Reason', source: 'provider', confirm: true }),
      () => client.createSuppression({ prospect_public_id: ULID, expected_revision: 1, target: 'email', reason: 'Reason', source: 'manual', confirm: false }),
      () => client.exportCandidates({ campaign_key: 'Invalid_Key', prospect_public_ids: [ULID], confirm_reexport: false }),
      () => client.exportCandidates({ campaign_key: campaign.key, prospect_public_ids: [], confirm_reexport: false }),
      () => client.exportCandidates({ campaign_key: campaign.key, prospect_public_ids: [ULID, ULID], confirm_reexport: false }),
      () => client.exportCandidates({ campaign_key: campaign.key, prospect_public_ids: uniqueUlids(101), confirm_reexport: false }),
      () => client.exportCandidates({ campaign_key: campaign.key, prospect_public_ids: [ULID], confirm_reexport: 0 }),
    ]

    for (const invoke of invalidCalls) {
      await expect(invoke()).rejects.toMatchObject({ kind: 'validation', status: null })
    }
    expect(tokenCalls).toBe(0)
    expect(calls).toEqual([])
  })

  test('accept every exact effective-status filter and send failed rather than presentation copy', async () => {
    const statuses: EffectiveStatus[] = [
      'draft',
      'preview_generating',
      'ready_for_review',
      'approved',
      'exported',
      'failed',
      'expired',
      'suppressed',
      'converted',
    ]
    for (const status of statuses) {
      queueJson(candidatePage)
      await client.listCandidates({ status })
    }

    expect(calls.map(call => call.options?.query)).toEqual(statuses.map(status => ({ status })))
    expect(JSON.stringify(calls.map(call => call.options?.query))).not.toContain('Failed preview')
  })

  test('accept exact integer and code-point edges while omitting blank optional filters', async () => {
    queueJson(candidatePage)
    queueJson(candidatePage)
    queueJson(suppressionPage)
    queueJson({ data: detail })
    queueJson({ data: detail })
    queueJson({ data: detail })
    queueJson({ data: suppression })
    queueRaw('email,subject\r\n', null)

    await client.listCandidates({ domain: '  ...  ', status: undefined, page: undefined, suppressed: undefined })
    await client.listCandidates({ domain: '😀'.repeat(253), page: MAX_INTEGER, suppressed: false })
    await client.listSuppressions({ page: MAX_INTEGER })
    await client.updateProspect(ULID, { expected_revision: 0, source_attested: true, notes: null })
    await client.updateDraft(ULID, { expected_revision: MAX_INTEGER, subject_line: 'Subject' })
    await client.approveCandidate(ULID, {
      expected_revision: 0,
      confirm_english_plain_text: true,
      confirm_public_source: true,
    })
    await client.createSuppression({
      prospect_public_id: ULID,
      expected_revision: MAX_INTEGER,
      target: 'product_domain',
      reason: 'Reason',
      source: 'manual',
      confirm: true,
    })
    await client.exportCandidates({
      campaign_key: campaign.key,
      prospect_public_ids: uniqueUlids(100),
      confirm_reexport: false,
    })

    expect(calls[0]?.options?.query).toBeUndefined()
    expect(calls[1]?.options?.query).toEqual({ domain: '😀'.repeat(253), suppressed: 0, page: MAX_INTEGER })
    expect(calls[2]?.options?.query).toEqual({ page: MAX_INTEGER })
    expect(calls[3]?.options?.body).toEqual({ expected_revision: 0, source_attested: true, notes: null })
    expect(calls[4]?.options?.body).toEqual({ expected_revision: MAX_INTEGER, subject_line: 'Subject' })
    expect(calls[5]?.options?.body).toEqual({
      expected_revision: 0,
      confirm_english_plain_text: true,
      confirm_public_source: true,
    })
    expect(calls[6]?.options?.body).toEqual({
      prospect_public_id: ULID,
      expected_revision: MAX_INTEGER,
      target: 'product_domain',
      reason: 'Reason',
      source: 'manual',
      confirm: true,
    })
    expect(calls[7]?.options?.body).toEqual({
      campaign_key: campaign.key,
      prospect_public_ids: uniqueUlids(100),
      confirm_reexport: false,
    })
  })
})

describe('committed recovery validation', () => {
  test('return only the canonical ID without fetching or replaying a mutation', () => {
    expect(subject.validateCommittedRecovery(recovery)).toBe(ULID)
    expect(subject.validateCommittedRecovery(recovery, ULID)).toBe(ULID)
    expect(tokenCalls).toBe(0)
    expect(calls).toEqual([])
  })

  test('reject malformed IDs, mismatched candidates, and arbitrary recovery URLs', () => {
    const invalidRecoveries: CommittedRecovery[] = [
      { ...recovery, public_id: ULID.toLowerCase() },
      { ...recovery, recovery_url: `https://evil.test/api/v1/admin/outreach/candidates/${ULID}` },
      { ...recovery, recovery_url: `/api/v1/admin/outreach/candidates/${SECOND_ULID}` },
      { ...recovery, recovery_url: `/api/v1/admin/outreach/candidates/${ULID}?token=secret` },
    ]
    for (const invalid of invalidRecoveries) {
      expect(() => subject.validateCommittedRecovery(invalid)).toThrow()
    }
    expect(() => subject.validateCommittedRecovery(recovery, SECOND_ULID)).toThrow()
    expect(calls).toEqual([])
  })
})

describe('safe outreach errors', () => {
  test('map every stable kind to a fixed local message', () => {
    const cases: Array<[unknown, OutreachApiErrorContract['kind'], number | null, string]> = [
      [{ status: 401, data: { message: 'REMOTE_401_SECRET' } }, 'unauthenticated', 401, 'Sign in again to continue.'],
      [{ status: 403, data: { message: 'REMOTE_403_SECRET' } }, 'forbidden', 403, 'You do not have permission to do that.'],
      [{ status: 404, data: { message: 'REMOTE_404_SECRET' } }, 'not_found', 404, 'This outreach record was not found.'],
      [{ status: 409, data: { message: 'This candidate changed. Reload and review it again.' } }, 'stale_revision', 409, 'This candidate changed. Reload and review it again.'],
      [{ status: 409, data: { message: 'REMOTE_CONFLICT_SECRET' } }, 'conflict', 409, 'This action conflicts with the current candidate state.'],
      [{ status: 422, data: { message: 'REMOTE_VALIDATION_SECRET' } }, 'validation', 422, 'Check the highlighted fields.'],
      [{ status: 429, data: { message: 'REMOTE_RATE_SECRET' } }, 'rate_limited', 429, 'Too many requests. Wait and try again.'],
      [{ status: 500, data: { message: 'REMOTE_SERVER_SECRET' } }, 'server', 500, 'LaunchLog could not complete this request.'],
      [{ status: 418, data: { message: 'REMOTE_UNEXPECTED_SECRET' } }, 'server', 418, 'LaunchLog could not complete this request.'],
      [new DOMException('REMOTE_ABORT_SECRET', 'AbortError'), 'aborted', null, 'The request was cancelled.'],
      [new Error('REMOTE_NETWORK_SECRET'), 'network', null, 'Could not reach LaunchLog. Check your connection and try again.'],
    ]

    for (const [remote, kind, status, message] of cases) {
      const mapped = subject.mapOutreachApiError(remote)
      expect(mapped).toBeInstanceOf(subject.OutreachApiError)
      expect(mapped.kind).toBe(kind)
      expect(mapped.status).toBe(status)
      expect(mapped.message).toBe(message)
      expect(mapped.fieldErrors).toEqual({})
      expect(mapped.name).toBe('OutreachApiError')
      expect('cause' in mapped).toBeFalse()
      expect(JSON.stringify(mapped)).not.toContain('REMOTE_')
      expect(mapped.stack ?? '').not.toContain('REMOTE_')
      expect(subject.mapOutreachApiError(mapped)).toBe(mapped)
    }
  })

  test('allowlist and bound validation fields without retaining backend messages', () => {
    const allowed = [
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
    ]
    const errors: Record<string, unknown> = {}
    for (const key of [...allowed].reverse()) {
      errors[key] = [`REMOTE_${key}_SECRET`]
    }
    errors.unknown = ['REMOTE_UNKNOWN_SECRET']
    errors.product_name = [42]
    errors['prospect_public_ids.0'] = ['REMOTE_INDEX_ZERO_SECRET']
    errors['prospect_public_ids.99'] = [false, 'REMOTE_INDEX_99_SECRET']
    errors['prospect_public_ids.100'] = ['REMOTE_INDEX_100_SECRET']

    const mapped = subject.mapOutreachApiError({
      status: 422,
      request: { url: 'https://secret.test' },
      response: { headers: { Authorization: 'SECRET' } },
      data: { message: 'REMOTE_TOP_SECRET', errors, payload: 'REMOTE_PAYLOAD_SECRET' },
    })

    expect(mapped.kind).toBe('validation')
    expect(Object.keys(mapped.fieldErrors)).toEqual([
      ...allowed.filter(key => key !== 'product_name'),
      'prospect_public_ids.0',
      'prospect_public_ids.99',
    ].slice(0, 32))
    for (const messages of Object.values(mapped.fieldErrors)) {
      expect(messages).toEqual(['Check this field.'])
      expect(Array.from(messages[0] ?? '').length).toBe(17)
    }
    const serialized = `${mapped.message}|${mapped.stack}|${JSON.stringify(mapped)}`
    expect(serialized).not.toContain('REMOTE_')
    expect(serialized).not.toContain('secret.test')
    expect(serialized).not.toContain('Authorization')
    expect('request' in mapped).toBeFalse()
    expect('response' in mapped).toBeFalse()
    expect('payload' in mapped).toBeFalse()
    expect('_data' in mapped).toBeFalse()
  })

  test('map JSON request failures through the safe boundary', async () => {
    rejectJson({ status: 403, data: { message: 'REMOTE_CLIENT_SECRET', token: 'SECRET_TOKEN' } })

    const failure = client.listCampaigns()
    await expect(failure).rejects.toMatchObject({
      kind: 'forbidden',
      status: 403,
      message: 'You do not have permission to do that.',
    })
    await failure.catch((error: unknown) => {
      expect(JSON.stringify(error)).not.toContain('REMOTE_CLIENT_SECRET')
      expect(JSON.stringify(error)).not.toContain('SECRET_TOKEN')
    })
    expect(calls).toHaveLength(1)
  })

  test('map already-aborted JSON and raw transports without retaining a transient cause', async () => {
    const remoteAbort = {
      name: 'FetchError',
      message: 'RAW_ABORT_MESSAGE_PII',
      cause: { name: 'AbortError', message: 'RAW_ABORT_CAUSE_PII' },
      request: { authorization: 'RAW_ABORT_TOKEN_PII' },
    }
    const jsonAbort = new AbortController()
    jsonAbort.abort()
    rejectJson(remoteAbort)

    const jsonFailure = client.listCampaigns({ signal: jsonAbort.signal })
    await expect(jsonFailure).rejects.toMatchObject({
      kind: 'aborted',
      status: null,
      message: 'The request was cancelled.',
    })
    await jsonFailure.catch((error: unknown) => {
      expect(ownReachableText(error)).not.toContain('RAW_ABORT')
      expect(error).not.toHaveProperty('cause')
    })

    const rawAbort = new AbortController()
    rawAbort.abort()
    rejectRaw(remoteAbort)
    const rawFailure = client.exportCandidates({
      campaign_key: 'founders-2026',
      prospect_public_ids: [ULID],
      confirm_reexport: false,
    }, { signal: rawAbort.signal })
    await expect(rawFailure).rejects.toMatchObject({
      kind: 'aborted',
      status: null,
      message: 'The request was cancelled.',
    })
    await rawFailure.catch((error: unknown) => {
      expect(ownReachableText(error)).not.toContain('RAW_ABORT')
      expect(error).not.toHaveProperty('cause')
    })
    expect(calls).toHaveLength(2)
  })
})

describe('network-free CSV browser seam', () => {
  test('return byte-exact Unicode CRLF text in an in-memory CSV Blob', async () => {
    const csv = 'email,subject\r\nada@acme.test,"Salut, 🚀"\r\n'
    queueRaw(csv, 'attachment; filename="launchlog-outreach-founders-2026.csv"')

    const result = await client.exportCandidates({
      campaign_key: campaign.key,
      prospect_public_ids: [ULID],
      confirm_reexport: false,
    })

    expect(result.filename).toBe('launchlog-outreach-founders-2026.csv')
    expect(Reflect.ownKeys(result).map(key => String(key)).sort()).toEqual(['blob', 'filename'])
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    expect(result.blob.type).toBe('text/csv;charset=UTF-8')
    expect(await result.blob.text()).toBe(csv)
    expect(Array.from(new Uint8Array(await result.blob.arrayBuffer())))
      .toEqual(Array.from(new TextEncoder().encode(csv)))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.raw).toBeTrue()
    expect(calls[0]?.options?.retry).toBe(0)
  })

  test('use the deterministic campaign filename for every unsafe or unavailable header', async () => {
    const headers = [
      null,
      '',
      'attachment',
      'attachment; filename*=UTF-8\'\'launchlog-outreach-founders-2026.csv',
      'attachment; filename=launchlog-outreach-founders-2026.csv',
      'attachment; filename="../launchlog-outreach-founders-2026.csv"',
      'attachment; filename="launchlog-outreach-other.csv"',
      'attachment; filename="launchlog-outreach-founders-2026.CSV"',
      'attachment; filename="lăunchlog-outreach-founders-2026.csv"',
      'attachment; filename="launchlog-outreach-founders-2026.csv\nunsafe"',
    ]

    for (const header of headers) {
      queueRaw('email,subject\r\n', header)
      const result = await client.exportCandidates({
        campaign_key: campaign.key,
        prospect_public_ids: [ULID],
        confirm_reexport: false,
      })
      expect(result.filename).toBe('launchlog-outreach-founders-2026.csv')
    }
  })

  test('map raw export failures without retaining CSV or backend payloads', async () => {
    const remote = {
      status: 422,
      data: {
        message: 'REMOTE_EXPORT_SECRET',
        errors: { prospect_public_ids: ['REMOTE_ID_SECRET'] },
        csv: 'REMOTE_CSV_SECRET',
      },
      cause: { original: 'REMOTE_CAUSE_SECRET' },
      originalError: 'REMOTE_ORIGINAL_ERROR_SECRET',
    }
    const remoteSymbol = Symbol('REMOTE_SYMBOL_SECRET')
    Object.defineProperty(remote, 'hidden', { value: 'REMOTE_HIDDEN_SECRET', enumerable: false })
    Reflect.set(remote, remoteSymbol, 'REMOTE_SYMBOL_VALUE_SECRET')
    rejectRaw(remote)

    const failure = client.exportCandidates({
      campaign_key: campaign.key,
      prospect_public_ids: [ULID],
      confirm_reexport: false,
    })
    let caught: unknown
    try {
      await failure
    }
    catch (error) {
      caught = error
    }
    expect(caught).toMatchObject({
      kind: 'validation',
      fieldErrors: { prospect_public_ids: ['Check this field.'] },
    })
    const retained = ownReachableText(caught)
    for (const sentinel of [
      'REMOTE_EXPORT_SECRET',
      'REMOTE_ID_SECRET',
      'REMOTE_CSV_SECRET',
      'REMOTE_CAUSE_SECRET',
      'REMOTE_ORIGINAL_ERROR_SECRET',
      'REMOTE_HIDDEN_SECRET',
      'REMOTE_SYMBOL_SECRET',
      'REMOTE_SYMBOL_VALUE_SECRET',
    ]) {
      expect(retained).not.toContain(sentinel)
    }
    expect(ownReachableText(caught)).not.toContain('originalError')
    expect(ownReachableText(caught)).not.toContain('cause')
    expect(calls).toHaveLength(1)
  })

  test('never create a browser download, persist data, or contact another surface', async () => {
    const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
    const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
    const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    const sessionStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
    const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
    const webSocketDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket')
    const eventSourceDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'EventSource')
    const fail = (): never => {
      throw new Error('Forbidden browser or delivery side effect.')
    }

    Object.defineProperty(URL, 'createObjectURL', { value: fail, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: fail, configurable: true })
    Object.defineProperty(globalThis, 'document', { get: fail, configurable: true })
    Object.defineProperty(globalThis, 'localStorage', { get: fail, configurable: true })
    Object.defineProperty(globalThis, 'sessionStorage', { get: fail, configurable: true })
    Object.defineProperty(globalThis, 'navigator', { get: fail, configurable: true })
    Object.defineProperty(globalThis, 'fetch', { get: fail, configurable: true })
    Object.defineProperty(globalThis, 'WebSocket', { get: fail, configurable: true })
    Object.defineProperty(globalThis, 'EventSource', { get: fail, configurable: true })

    try {
      queueRaw('email,subject\r\n', null)
      const result = await client.exportCandidates({
        campaign_key: campaign.key,
        prospect_public_ids: [ULID],
        confirm_reexport: false,
      })
      expect(await result.blob.text()).toBe('email,subject\r\n')
      expect(calls).toHaveLength(1)
      expect(calls[0]?.url).toBe(`${API}/api/v1/admin/outreach/exports`)
    }
    finally {
      if (createDescriptor !== undefined) Object.defineProperty(URL, 'createObjectURL', createDescriptor)
      if (revokeDescriptor !== undefined) Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor)
      if (documentDescriptor === undefined) Reflect.deleteProperty(globalThis, 'document')
      else Object.defineProperty(globalThis, 'document', documentDescriptor)
      if (localStorageDescriptor === undefined) Reflect.deleteProperty(globalThis, 'localStorage')
      else Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor)
      if (sessionStorageDescriptor === undefined) Reflect.deleteProperty(globalThis, 'sessionStorage')
      else Object.defineProperty(globalThis, 'sessionStorage', sessionStorageDescriptor)
      if (navigatorDescriptor === undefined) Reflect.deleteProperty(globalThis, 'navigator')
      else Object.defineProperty(globalThis, 'navigator', navigatorDescriptor)
      if (fetchDescriptor === undefined) Reflect.deleteProperty(globalThis, 'fetch')
      else Object.defineProperty(globalThis, 'fetch', fetchDescriptor)
      if (webSocketDescriptor === undefined) Reflect.deleteProperty(globalThis, 'WebSocket')
      else Object.defineProperty(globalThis, 'WebSocket', webSocketDescriptor)
      if (eventSourceDescriptor === undefined) Reflect.deleteProperty(globalThis, 'EventSource')
      else Object.defineProperty(globalThis, 'EventSource', eventSourceDescriptor)
    }
  })
})
