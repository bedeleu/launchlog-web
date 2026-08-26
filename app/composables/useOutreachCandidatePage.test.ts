import { beforeEach, describe, expect, test } from 'bun:test'
import { effectScope, isReactive, onScopeDispose as vueOnScopeDispose, watch } from 'vue'

type CampaignStatus = 'draft' | 'active' | 'archived'
type PersistedStatus = 'draft' | 'ready_for_review' | 'approved' | 'exported'
type EffectiveStatus = 'draft' | 'preview_generating' | 'ready_for_review' | 'approved' | 'exported' | 'failed' | 'expired' | 'suppressed' | 'converted'
type EditState = 'clean' | 'dirty' | 'saving' | 'stale' | 'save_error'
type ErrorKind = 'unauthenticated' | 'forbidden' | 'not_found' | 'stale_revision' | 'conflict' | 'validation' | 'rate_limited' | 'server' | 'aborted' | 'network'

interface SafeError extends Error {
  kind: ErrorKind
  status: number | null
  fieldErrors: Record<string, string[]>
}

interface Actor {
  name: string | null
  email: string | null
}

interface Candidate {
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
  suppressions: Array<{
    kind: 'email' | 'domain'
    value: string
    reason: string
    source: 'manual' | 'opt_out'
    created_by: Actor | null
    created_at: string
    updated_at: string
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

interface Recovery {
  public_id: string
  persistence_status: 'committed'
  recovery_url: string
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

interface Transport {
  signal?: AbortSignal
}

interface Api {
  getCandidate: (publicId: string, transport?: Transport) => Promise<Candidate>
  updateProspect: (publicId: string, payload: Record<string, unknown>, transport?: Transport) => Promise<unknown>
  updateDraft: (publicId: string, payload: Record<string, unknown>, transport?: Transport) => Promise<unknown>
  approveCandidate: (publicId: string, payload: Record<string, unknown>, transport?: Transport) => Promise<unknown>
  recaptureCandidate: (publicId: string, transport?: Transport) => Promise<unknown>
  renewCandidate: (publicId: string, transport?: Transport) => Promise<unknown>
  updateCampaign: (key: string, payload: Record<string, unknown>, transport?: Transport) => Promise<unknown>
  createSuppression: (payload: Record<string, unknown>, transport?: Transport) => Promise<unknown>
  exportCandidates: (payload: Record<string, unknown>, transport?: Transport) => Promise<unknown>
}

interface ProspectForm {
  company_name: string
  product_name: string
  founder_first_name: string | null
  business_email: string
  country_code: string | null
  source_url: string
  source_context: string
  notes: string | null
}

interface DraftForm {
  subject_line: string
  opening_line: string
  email_body: string
}

interface ControllerView {
  load: 'idle' | 'loading' | 'ready' | 'load_error'
  effective: EffectiveStatus | null
  persisted: PersistedStatus | null
  campaign: CampaignStatus | null
  action: ControllerState['action']
  refresh_required: boolean
  edits: { prospect: EditState, draft: EditState }
  blockers: {
    approve: string[]
    export: string[]
    recapture: string[]
    renew: string[]
    suppress: string[]
  }
  audit: {
    approved_at: string | null
    approved_by: Actor | null
    exported_at: string | null
    exported_by: Actor | null
    export_count: number
    last_export_hash: string | null
    requires_reexport_confirmation: boolean
  }
  timing: {
    expires_at: string | null
    expiry_valid: boolean
    remaining_ms: number | null
    expired: boolean
    has_review_window: boolean
    in_renewal_window: boolean
  }
}

interface ControllerState {
  candidate: Candidate | null
  load: 'idle' | 'loading' | 'ready' | 'load_error'
  prospect_form: ProspectForm
  draft_form: DraftForm
  prospect_edit: EditState
  draft_edit: EditState
  suppression_draft: {
    target: 'email' | 'product_domain' | 'effective_domain' | null
    reason: string
    source: 'manual' | 'opt_out'
    confirmed: boolean
    confirmed_revision: number | null
  }
  suppression_dirty: boolean
  approval_english_plain_text: boolean
  approval_public_source: boolean
  campaign_activation_confirmed: boolean
  reexport_confirmed: boolean
  discard_confirmation_required: boolean
  refresh_required: boolean
  poll_active: boolean
  poll_deadline_reached: boolean
  load_error: SafeError | null
  poll_error: SafeError | null
  action_error: SafeError | null
  validation_errors: Record<string, string[]>
  action: {
    name: null | 'refresh' | 'activate_campaign' | 'save_prospect' | 'save_draft' | 'approve' | 'recapture' | 'renew' | 'suppress' | 'export'
    phase: 'idle' | 'pending' | 'success' | 'validation_error' | 'action_error'
  }
  view: ControllerView
}

interface Controller {
  state: ControllerState
  load: () => Promise<void>
  refresh: () => Promise<void>
  confirmDiscardAndRefresh: () => Promise<void>
  cancelDiscardRefresh: () => void
  setProspectField: (field: keyof ProspectForm, value: string | null) => void
  setDraftField: (field: keyof DraftForm, value: string) => void
  saveProspect: () => Promise<void>
  saveDraft: () => Promise<void>
  setApprovalEnglishPlainText: (confirmed: boolean) => void
  setApprovalPublicSource: (confirmed: boolean) => void
  approve: () => Promise<void>
  setCampaignActivationConfirmed: (confirmed: boolean) => void
  activateCampaign: () => Promise<void>
  recapture: () => Promise<void>
  renew: () => Promise<void>
  setSuppressionTarget: (target: 'email' | 'product_domain' | 'effective_domain' | null) => void
  setSuppressionReason: (reason: string) => void
  setSuppressionSource: (source: 'manual' | 'opt_out') => void
  setSuppressionConfirmed: (confirmed: boolean) => void
  suppress: () => Promise<void>
  setReexportConfirmed: (confirmed: boolean) => void
  exportCandidate: () => Promise<{ blob: Blob, filename: string }>
  dispose: () => void
}

interface TimerEntry {
  id: number
  delay: number
  callback: () => void
  cancelled: boolean
}

interface CandidatePageModule {
  createOutreachCandidatePageController: (publicId: string, deps: {
    api: Api
    now: () => number
    setTimeout: (callback: () => void, delay: number) => number
    clearTimeout: (handle: number) => void
    createAbortController: () => AbortController
    createState?: (initial: ControllerState) => ControllerState
  }) => Controller
  useOutreachCandidatePage: (publicId: string) => Controller
}

interface ApiCall {
  name: keyof Api
  publicId?: string
  key?: string
  payload?: Record<string, unknown>
  transport?: Transport
}

type CandidateThunk = () => Promise<Candidate>
type MutationThunk = () => Promise<unknown>
type CampaignThunk = () => Promise<unknown>
type SuppressionThunk = () => Promise<unknown>
type ExportThunk = () => Promise<unknown>

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

const modulePath = ['./useOutreachCandidatePage', 'ts'].join('.')
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
  throw new Error('Outreach controller import touched a forbidden external surface.')
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
  if (importCreateObjectUrlDescriptor === undefined) Reflect.deleteProperty(URL, 'createObjectURL')
  else Object.defineProperty(URL, 'createObjectURL', importCreateObjectUrlDescriptor)
  if (importRevokeObjectUrlDescriptor === undefined) Reflect.deleteProperty(URL, 'revokeObjectURL')
  else Object.defineProperty(URL, 'revokeObjectURL', importRevokeObjectUrlDescriptor)
}

const subject = importedModule as CandidatePageModule

const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const SECOND_ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAW'
const NOW_START = Date.parse('2026-08-26T12:00:00.000Z')
const TEN_MINUTES = 10 * 60 * 1000

function installExternalSideEffectGuards(): () => void {
  const descriptors = new Map<string, PropertyDescriptor | undefined>()
  const fail = (): never => {
    throw new Error('Outreach controller touched a forbidden network, storage, DOM, beacon, or provider surface.')
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

function astral(count: number): string {
  return '😀'.repeat(count)
}

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  const base: Candidate = {
    public_id: ULID,
    campaign: {
      name: 'Founders 2026',
      key: 'founders-2026',
      status: 'active',
      sender_identity_label: 'Warmed founder domain',
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
      expires_at: '2026-08-30T12:00:00.000Z',
      capabilities: { edit: false, recapture: false, checkout: true },
    },
    draft: {
      subject_line: 'A private preview for Acme',
      opening_line: 'Hi Ada, I found Acme in a public directory.',
      email_body: 'I prepared a private LaunchLog preview for your review.',
    },
    validation_errors: [],
    suppressions: [],
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

  return { ...base, ...overrides }
}

function richCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return candidate({
    failure: { code: 'preview_fetch_failed', message: 'Preview capture failed safely.' },
    preview: {
      ...fixturePreview(),
      error: { code: 'preview_fetch_failed', message: 'Preview capture failed safely.' },
    },
    validation_errors: { email_body: ['Check this field.'] },
    suppressions: [{
      kind: 'email',
      value: 'ada@acme.test',
      reason: 'Requested opt out',
      source: 'opt_out',
      created_by: { name: 'Admin', email: 'admin@launchlog.ai' },
      created_at: '2026-08-26T09:00:00.000Z',
      updated_at: '2026-08-26T09:00:00.000Z',
      matched_targets: ['email', 'email_domain'],
    }],
    audit: {
      approved_at: '2026-08-26T10:00:00.000Z',
      approved_by: { name: 'Admin', email: 'admin@launchlog.ai' },
      exported_at: '2026-08-26T11:00:00.000Z',
      exported_by: { name: 'Admin', email: 'admin@launchlog.ai' },
      export_count: 1,
      last_export_hash: 'b'.repeat(64),
    },
    ...overrides,
  })
}

function withForbiddenCandidateExtras(source: Candidate): Candidate {
  const response = structuredClone(source)
  Object.assign(response, { forbidden_top: 'RAW_TOP_LEVEL_PII' })
  Object.assign(response, {
    validation_errors: {
      email_body: ['RAW_SERVER_VALIDATION_PII'],
      arbitrary_private_field: ['RAW_PRIVATE_VALIDATION_PII'],
    },
  })
  Object.assign(response.campaign, { forbidden_campaign: 'RAW_CAMPAIGN_SECRET' })
  Object.assign(response.prospect, { forbidden_prospect: 'RAW_PROSPECT_SECRET' })
  Object.assign(response.prospect.source_attested_by, { forbidden_actor: 'RAW_ACTOR_SECRET' })
  if (response.failure !== null) Object.assign(response.failure, { forbidden_failure: 'RAW_FAILURE_SECRET' })
  if (response.preview !== null) {
    Object.assign(response.preview, { forbidden_preview: 'RAW_PREVIEW_SECRET' })
    Object.assign(response.preview.capabilities, { forbidden_capability: 'RAW_CAPABILITY_SECRET' })
    if (response.preview.error !== null) Object.assign(response.preview.error, { forbidden_error: 'RAW_ERROR_SECRET' })
  }
  if (response.draft !== null) Object.assign(response.draft, { forbidden_draft: 'RAW_DRAFT_SECRET' })
  for (const suppression of response.suppressions) {
    Object.assign(suppression, { forbidden_suppression: 'RAW_SUPPRESSION_SECRET' })
    if (suppression.created_by !== null) Object.assign(suppression.created_by, { forbidden_actor: 'RAW_SUPPRESSION_ACTOR_SECRET' })
  }
  Object.assign(response.audit, { forbidden_audit: 'RAW_AUDIT_SECRET' })
  if (response.audit.approved_by !== null) Object.assign(response.audit.approved_by, { forbidden_actor: 'RAW_APPROVER_SECRET' })
  if (response.audit.exported_by !== null) Object.assign(response.audit.exported_by, { forbidden_actor: 'RAW_EXPORTER_SECRET' })
  return response
}

function malformedCandidate(mutator: (value: Candidate) => void): Candidate {
  const value = structuredClone(candidate())
  mutator(value)
  return value
}

function generating(overrides: Partial<Candidate> = {}): Candidate {
  const base = candidate()
  if (base.preview === null) throw new Error('Fixture requires a preview.')

  return candidate({
    persisted_status: 'draft',
    effective_status: 'preview_generating',
    preview: { ...base.preview, status: 'generating' },
    ...overrides,
  })
}

function approved(overrides: Partial<Candidate> = {}): Candidate {
  return candidate({
    persisted_status: 'approved',
    effective_status: 'approved',
    audit: {
      approved_at: '2026-08-26T11:00:00.000Z',
      approved_by: { name: 'Admin', email: 'admin@launchlog.ai' },
      exported_at: null,
      exported_by: null,
      export_count: 0,
      last_export_hash: null,
    },
    ...overrides,
  })
}

function fixtureDraft(): NonNullable<Candidate['draft']> {
  const draft = candidate().draft
  if (draft === null) throw new Error('Fixture requires a draft.')
  return draft
}

function fixturePreview(): NonNullable<Candidate['preview']> {
  const preview = candidate().preview
  if (preview === null) throw new Error('Fixture requires a preview.')
  return preview
}

function safeError(kind: ErrorKind, fieldErrors: Record<string, string[]> = {}): SafeError {
  const messages: Record<ErrorKind, string> = {
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
  return Object.assign(new Error(messages[kind]), {
    name: 'OutreachApiError',
    kind,
    status: null,
    fieldErrors,
  })
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {
    throw new Error('Deferred promise was not initialized.')
  }
  let reject: (error: unknown) => void = () => {
    throw new Error('Deferred promise was not initialized.')
  }
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

let nowMs: number
let timers: TimerEntry[]
let nextTimerId: number
let abortControllers: AbortController[]
let apiCalls: ApiCall[]
let getQueue: CandidateThunk[]
let prospectQueue: MutationThunk[]
let draftQueue: MutationThunk[]
let approveQueue: MutationThunk[]
let recaptureQueue: MutationThunk[]
let renewQueue: MutationThunk[]
let campaignQueue: CampaignThunk[]
let suppressionQueue: SuppressionThunk[]
let exportQueue: ExportThunk[]
let serverCandidate: Candidate
let api: Api
let controller: Controller

function take<T>(queue: Array<() => Promise<T>>, fallback: () => Promise<T>): Promise<T> {
  const thunk = queue.shift() ?? fallback
  return thunk()
}

function createApi(): Api {
  return {
    getCandidate: (publicId, transport) => {
      apiCalls.push({ name: 'getCandidate', publicId, transport })
      return take(getQueue, async () => structuredClone(serverCandidate))
    },
    updateProspect: (publicId, payload, transport) => {
      apiCalls.push({ name: 'updateProspect', publicId, payload: structuredClone(payload), transport })
      return take(prospectQueue, async () => structuredClone(serverCandidate))
    },
    updateDraft: (publicId, payload, transport) => {
      apiCalls.push({ name: 'updateDraft', publicId, payload: structuredClone(payload), transport })
      return take(draftQueue, async () => structuredClone(serverCandidate))
    },
    approveCandidate: (publicId, payload, transport) => {
      apiCalls.push({ name: 'approveCandidate', publicId, payload: structuredClone(payload), transport })
      return take(approveQueue, async () => structuredClone(serverCandidate))
    },
    recaptureCandidate: (publicId, transport) => {
      apiCalls.push({ name: 'recaptureCandidate', publicId, transport })
      return take(recaptureQueue, async () => structuredClone(serverCandidate))
    },
    renewCandidate: (publicId, transport) => {
      apiCalls.push({ name: 'renewCandidate', publicId, transport })
      return take(renewQueue, async () => structuredClone(serverCandidate))
    },
    updateCampaign: (key, payload, transport) => {
      apiCalls.push({ name: 'updateCampaign', key, payload: structuredClone(payload), transport })
      return take(campaignQueue, async () => ({
        ...serverCandidate.campaign,
        status: 'active',
        candidate_count: 1,
        created_at: serverCandidate.created_at,
        updated_at: serverCandidate.updated_at,
      }))
    },
    createSuppression: (payload, transport) => {
      apiCalls.push({ name: 'createSuppression', payload: structuredClone(payload), transport })
      return take(suppressionQueue, async () => ({
        kind: 'email',
        value: 'ada@acme.test',
        reason: 'Manual suppression',
        source: 'manual',
        created_by: null,
        created_at: '2026-08-26T12:00:00.000Z',
        updated_at: '2026-08-26T12:00:00.000Z',
      }))
    },
    exportCandidates: (payload, transport) => {
      apiCalls.push({ name: 'exportCandidates', payload: structuredClone(payload), transport })
      return take(exportQueue, async () => ({
        blob: new Blob(['email,subject\r\nada@acme.test,Hello\r\n'], { type: 'text/csv;charset=UTF-8' }),
        filename: 'launchlog-outreach-founders-2026.csv',
      }))
    },
  }
}

function createController(createState?: (initial: ControllerState) => ControllerState): Controller {
  return subject.createOutreachCandidatePageController(ULID, {
    api,
    now: () => nowMs,
    setTimeout: (callback, delay) => {
      nextTimerId += 1
      timers.push({ id: nextTimerId, callback, delay, cancelled: false })
      return nextTimerId
    },
    clearTimeout: (handle) => {
      const timer = timers.find(entry => entry.id === handle)
      if (timer !== undefined) timer.cancelled = true
    },
    createAbortController: () => {
      const abortController = new AbortController()
      abortControllers.push(abortController)
      return abortController
    },
    createState,
  })
}

function activeTimers(): TimerEntry[] {
  return timers.filter(timer => !timer.cancelled)
}

async function fireNextTimer(): Promise<void> {
  const timer = activeTimers()[0]
  if (timer === undefined) throw new Error('Expected an active timer.')
  timer.cancelled = true
  timer.callback()
  await flushMicrotasks()
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve()
  }
}

async function expectEveryMutationBlockedWithoutApiCall(): Promise<void> {
  const before = apiCalls.length
  const mutations: Array<() => Promise<unknown>> = [
    () => controller.saveProspect(),
    () => controller.saveDraft(),
    () => controller.approve(),
    () => controller.recapture(),
    () => controller.renew(),
    () => controller.activateCampaign(),
    () => controller.suppress(),
    () => controller.exportCandidate(),
  ]
  for (const mutation of mutations) {
    await expect(mutation()).rejects.toBeDefined()
  }
  expect(apiCalls).toHaveLength(before)
}

function resetHarness(initialCandidate: Candidate = candidate()): void {
  nowMs = NOW_START
  timers = []
  nextTimerId = 0
  abortControllers = []
  apiCalls = []
  getQueue = []
  prospectQueue = []
  draftQueue = []
  approveQueue = []
  recaptureQueue = []
  renewQueue = []
  campaignQueue = []
  suppressionQueue = []
  exportQueue = []
  serverCandidate = initialCandidate
  api = createApi()
  controller = createController()
}

beforeEach(() => {
  resetHarness()
})

describe('candidate load and fixed-window polling', () => {
  test('start idle with empty volatile state and no construction-time request', () => {
    expect(typeof subject.useOutreachCandidatePage).toBe('function')
    expect(apiCalls).toEqual([])
    expect(controller.state.load).toBe('idle')
    expect(controller.state.candidate).toBeNull()
    expect(controller.state.prospect_form).toEqual({
      company_name: '',
      product_name: '',
      founder_first_name: null,
      business_email: '',
      country_code: null,
      source_url: '',
      source_context: '',
      notes: null,
    })
    expect(controller.state.draft_form).toEqual({ subject_line: '', opening_line: '', email_body: '' })
    expect(controller.state.suppression_draft).toEqual({
      target: null,
      reason: '',
      source: 'manual',
      confirmed: false,
      confirmed_revision: null,
    })
    expect(controller.state.suppression_dirty).toBeFalse()
    expect(controller.state.view).toMatchObject({
      load: 'idle',
      effective: null,
      persisted: null,
      campaign: null,
      action: { name: null, phase: 'idle' },
      refresh_required: false,
      edits: { prospect: 'clean', draft: 'clean' },
      audit: {
        approved_at: null,
        exported_at: null,
        export_count: 0,
        last_export_hash: null,
        requires_reexport_confirmation: false,
      },
      timing: {
        expires_at: null,
        expiry_valid: false,
        remaining_ms: null,
        expired: false,
        has_review_window: false,
        in_renewal_window: false,
      },
    })
    for (const blockers of Object.values(controller.state.view.blockers)) {
      expect(blockers).toContain('not_loaded')
    }
  })

  test('expose reactive wrapper state and notify Vue watchers for async load transitions', async () => {
    const runtimeDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'useRuntimeConfig')
    const authDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'useAuth')
    const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, '$fetch')
    const scopeDisposeDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'onScopeDispose')
    Object.defineProperty(globalThis, 'useRuntimeConfig', {
      value: () => ({ public: { apiUrl: 'https://api.launchlog.test' } }),
      configurable: true,
    })
    Object.defineProperty(globalThis, 'useAuth', {
      value: () => ({ getIdToken: async () => 'wrapper-token' }),
      configurable: true,
    })
    Object.defineProperty(globalThis, '$fetch', {
      value: async () => ({ data: candidate() }),
      configurable: true,
    })
    Object.defineProperty(globalThis, 'onScopeDispose', { value: vueOnScopeDispose, configurable: true })

    const scope = effectScope()
    const transitions: ControllerState['load'][] = []
    try {
      const operation = scope.run(async () => {
        const wrapped = subject.useOutreachCandidatePage(ULID)
        const stateIsReactive = isReactive(wrapped.state)
        watch(() => wrapped.state.load, value => transitions.push(value), { flush: 'sync' })

        await wrapped.load()

        expect(stateIsReactive).toBeTrue()
        expect(wrapped.state.candidate).toEqual(candidate())
      })
      if (operation === undefined) throw new Error('Expected an active Vue effect scope.')
      await operation
      expect(transitions).toEqual(['loading', 'ready'])
    }
    finally {
      scope.stop()
      if (runtimeDescriptor === undefined) Reflect.deleteProperty(globalThis, 'useRuntimeConfig')
      else Object.defineProperty(globalThis, 'useRuntimeConfig', runtimeDescriptor)
      if (authDescriptor === undefined) Reflect.deleteProperty(globalThis, 'useAuth')
      else Object.defineProperty(globalThis, 'useAuth', authDescriptor)
      if (fetchDescriptor === undefined) Reflect.deleteProperty(globalThis, '$fetch')
      else Object.defineProperty(globalThis, '$fetch', fetchDescriptor)
      if (scopeDisposeDescriptor === undefined) Reflect.deleteProperty(globalThis, 'onScopeDispose')
      else Object.defineProperty(globalThis, 'onScopeDispose', scopeDisposeDescriptor)
    }
  })

  test('project exact full candidate shapes from GET, poll, mutation, and recovery paths', async () => {
    let expected = richCandidate()
    getQueue.push(async () => withForbiddenCandidateExtras(expected))
    await controller.load()
    expect(controller.state.candidate).toEqual(expected)

    expected = richCandidate({
      persisted_status: 'draft',
      effective_status: 'preview_generating',
      revision: 8,
      preview: { ...fixturePreview(), status: 'generating' },
    })
    resetHarness(generating())
    await controller.load()
    getQueue.push(async () => withForbiddenCandidateExtras(expected))
    await fireNextTimer()
    expect(controller.state.candidate).toEqual(expected)

    expected = richCandidate({
      revision: 8,
      prospect: { ...candidate().prospect, company_name: 'Projected prospect' },
    })
    resetHarness()
    await controller.load()
    controller.setProspectField('company_name', 'Projected prospect')
    prospectQueue.push(async () => withForbiddenCandidateExtras(expected))
    await controller.saveProspect()
    expect(controller.state.candidate).toEqual(expected)

    expected = richCandidate({
      revision: 8,
      draft: { ...fixtureDraft(), subject_line: 'Projected recovery draft' },
    })
    resetHarness()
    await controller.load()
    controller.setDraftField('subject_line', 'Projected recovery draft')
    draftQueue.push(async () => ({
      public_id: ULID,
      persistence_status: 'committed',
      recovery_url: `/api/v1/admin/outreach/candidates/${ULID}`,
    }))
    getQueue.push(async () => withForbiddenCandidateExtras(expected))
    await controller.saveDraft()
    expect(controller.state.candidate).toEqual(expected)
    expect(JSON.stringify(controller.state.candidate)).not.toContain('RAW_')
    expect(JSON.stringify(controller.state.candidate)).not.toContain('forbidden_')
  })

  test('reject malformed candidate literals, nullability, nested actors, audit, and capabilities', async () => {
    const malformedResponses: Array<[string, Candidate]> = [
      ['campaign status', malformedCandidate(value => Object.assign(value.campaign, { status: 'paused' }))],
      ['persisted status', malformedCandidate(value => Object.assign(value, { persisted_status: 'contacted' }))],
      ['effective status', malformedCandidate(value => Object.assign(value, { effective_status: 'sent' }))],
      ['nullable prospect', malformedCandidate(value => Object.assign(value.prospect, { founder_first_name: 42 }))],
      ['source actor', malformedCandidate(value => Object.assign(value.prospect, { source_attested_by: { name: false, email: null } }))],
      ['failure shape', malformedCandidate(value => Object.assign(value, { failure: { code: 'failed', message: null } }))],
      ['preview status', malformedCandidate(value => {
        if (value.preview !== null) Object.assign(value.preview, { status: 'complete' })
      })],
      ['preview literals', malformedCandidate(value => {
        if (value.preview !== null) Object.assign(value.preview.capabilities, { edit: true, recapture: false, checkout: true })
      })],
      ['draft nullability', malformedCandidate(value => {
        if (value.draft !== null) Object.assign(value.draft, { opening_line: null })
      })],
      ['suppression enum', malformedCandidate(value => Object.assign(value, {
        suppressions: [{
          kind: 'address',
          value: 'ada@acme.test',
          reason: 'Invalid literal',
          source: 'manual',
          created_by: null,
          created_at: '2026-08-26T09:00:00.000Z',
          updated_at: '2026-08-26T09:00:00.000Z',
          matched_targets: ['email'],
        }],
      }))],
      ['audit bounds', malformedCandidate(value => Object.assign(value.audit, { export_count: -1 }))],
      ['audit actor', malformedCandidate(value => Object.assign(value.audit, { approved_by: { name: 'Admin', email: 42 } }))],
      ['timestamp nullability', malformedCandidate(value => Object.assign(value, { updated_at: null }))],
    ]

    for (const [name, malformed] of malformedResponses) {
      resetHarness()
      getQueue.push(async () => malformed)

      await expect(controller.load(), name).rejects.toMatchObject({ kind: 'server' })
      expect(controller.state.candidate, name).toBeNull()
      expect(controller.state.load, name).toBe('load_error')
      expect(controller.state.load_error, name).toMatchObject({ kind: 'server' })
    }
  })

  test('reuse strict candidate validation for poll, full mutation, and committed recovery GET', async () => {
    resetHarness(generating())
    await controller.load()
    const lastGoodPoll = structuredClone(controller.state.candidate)
    getQueue.push(async () => malformedCandidate(value => Object.assign(value.prospect, {
      source_attested_by: { name: 'Admin', email: 42 },
    })))
    await fireNextTimer()
    expect(controller.state.candidate).toEqual(lastGoodPoll)
    expect(controller.state.poll_error).toMatchObject({ kind: 'server' })
    expect(controller.state.refresh_required).toBeFalse()

    resetHarness()
    await controller.load()
    const lastGoodMutation = structuredClone(controller.state.candidate)
    controller.setProspectField('company_name', 'Malformed full response')
    prospectQueue.push(async () => malformedCandidate(value => {
      if (value.preview !== null) Object.assign(value.preview.capabilities, { edit: true })
    }))
    await expect(controller.saveProspect()).rejects.toMatchObject({ kind: 'server' })
    expect(controller.state.candidate).toEqual(lastGoodMutation)
    expect(controller.state.refresh_required).toBeTrue()

    resetHarness()
    await controller.load()
    const lastGoodRecovery = structuredClone(controller.state.candidate)
    controller.setDraftField('subject_line', 'Malformed recovery response')
    draftQueue.push(async () => ({
      public_id: ULID,
      persistence_status: 'committed',
      recovery_url: `/api/v1/admin/outreach/candidates/${ULID}`,
    }))
    getQueue.push(async () => malformedCandidate(value => Object.assign(value.audit, { export_count: -1 })))
    await expect(controller.saveDraft()).rejects.toMatchObject({ kind: 'server' })
    expect(controller.state.candidate).toEqual(lastGoodRecovery)
    expect(controller.state.refresh_required).toBeTrue()
    expect(controller.state.prospect_edit).toBe('stale')
    expect(controller.state.draft_edit).toBe('stale')
  })

  test('keep every controller operation inside the injected API and scheduler seams', async () => {
    const restoreExternalSurfaces = installExternalSideEffectGuards()
    try {
      resetHarness()
      await controller.load()
      await controller.refresh()
      controller.setProspectField('company_name', 'Guarded company')
      prospectQueue.push(async () => candidate({
        revision: 8,
        prospect: { ...candidate().prospect, company_name: 'Guarded company' },
      }))
      await controller.saveProspect()
      expect(apiCalls.at(-1)?.name).toBe('updateProspect')

      controller.setDraftField('subject_line', 'Guarded subject')
      draftQueue.push(async () => candidate({
        revision: 9,
        draft: { ...fixtureDraft(), subject_line: 'Guarded subject' },
      }))
      await controller.saveDraft()
      expect(apiCalls.at(-1)?.name).toBe('updateDraft')

      controller.setApprovalEnglishPlainText(true)
      controller.setApprovalPublicSource(true)
      approveQueue.push(async () => approved({ revision: 10 }))
      await controller.approve()
      expect(apiCalls.at(-1)?.name).toBe('approveCandidate')

      resetHarness()
      await controller.load()
      controller.setProspectField('company_name', 'Discard me')
      const beforeDiscardGate = apiCalls.length
      await controller.refresh()
      expect(apiCalls).toHaveLength(beforeDiscardGate)
      controller.cancelDiscardRefresh()
      await controller.load()
      getQueue.push(async () => candidate({ revision: 8 }))
      await controller.confirmDiscardAndRefresh()
      expect(apiCalls.at(-1)?.name).toBe('getCandidate')

      resetHarness(candidate({ campaign: { ...candidate().campaign, status: 'draft' } }))
      await controller.load()
      controller.setCampaignActivationConfirmed(true)
      campaignQueue.push(async () => ({
        name: 'Founders active',
        key: 'founders-2026',
        status: 'active',
        sender_identity_label: 'Warmed founder domain',
        candidate_count: 1,
        created_at: '2026-08-25T10:00:00.000Z',
        updated_at: '2026-08-26T12:00:00.000Z',
      }))
      await controller.activateCampaign()
      expect(apiCalls.at(-1)?.name).toBe('updateCampaign')

      resetHarness(candidate({
        persisted_status: 'draft',
        effective_status: 'failed',
        preview: { ...fixturePreview(), status: 'failed' },
      }))
      await controller.load()
      recaptureQueue.push(async () => generating({ revision: 8 }))
      await controller.recapture()
      expect(apiCalls.at(-1)?.name).toBe('recaptureCandidate')

      resetHarness(candidate({
        persisted_status: 'draft',
        effective_status: 'expired',
        preview: { ...fixturePreview(), status: 'expired', expires_at: '2026-08-25T12:00:00.000Z' },
      }))
      await controller.load()
      renewQueue.push(async () => generating({ revision: 8 }))
      await controller.renew()
      expect(apiCalls.at(-1)?.name).toBe('renewCandidate')

      resetHarness()
      await controller.load()
      controller.setSuppressionTarget('effective_domain')
      controller.setSuppressionReason('Guarded suppression')
      controller.setSuppressionSource('opt_out')
      controller.setSuppressionConfirmed(true)
      suppressionQueue.push(async () => ({
        kind: 'domain',
        value: 'acme.test',
        reason: 'Guarded suppression',
        source: 'opt_out',
        created_by: null,
        created_at: '2026-08-26T12:00:00.000Z',
        updated_at: '2026-08-26T12:00:00.000Z',
      }))
      getQueue.push(async () => candidate({ revision: 8, effective_status: 'suppressed' }))
      await controller.suppress()
      expect(apiCalls.slice(-2).map(call => call.name)).toEqual(['createSuppression', 'getCandidate'])

      resetHarness(approved())
      await controller.load()
      exportQueue.push(async () => ({
        blob: new Blob(['email,subject\r\n']),
        filename: 'launchlog-outreach-founders-2026.csv',
      }))
      getQueue.push(async () => approved({ persisted_status: 'exported', effective_status: 'exported' }))
      const result = await controller.exportCandidate()
      expect(result.filename).toBe('launchlog-outreach-founders-2026.csv')
      expect(apiCalls.slice(-2).map(call => call.name)).toEqual(['exportCandidates', 'getCandidate'])

      controller.setReexportConfirmed(true)
      controller.setReexportConfirmed(false)
      controller.dispose()
    }
    finally {
      restoreExternalSurfaces()
    }
  })

  test('project every controller axis through the computed outreach view', async () => {
    serverCandidate = approved()
    await controller.load()
    const loadedCandidate = controller.state.candidate
    if (loadedCandidate === null || loadedCandidate.preview === null) {
      throw new Error('Expected a loaded candidate with a preview.')
    }

    expect(controller.state.view.load).toBe(controller.state.load)
    expect(controller.state.view.effective).toBe(loadedCandidate.effective_status)
    expect(controller.state.view.persisted).toBe(loadedCandidate.persisted_status)
    expect(controller.state.view.campaign).toBe(loadedCandidate.campaign.status)
    expect(controller.state.view.action).toEqual(controller.state.action)
    expect(controller.state.view.refresh_required).toBe(controller.state.refresh_required)
    expect(controller.state.view.edits).toEqual({ prospect: 'clean', draft: 'clean' })
    expect(controller.state.view.blockers.export).toEqual([])
    expect(controller.state.view.audit).toEqual({
      approved_at: '2026-08-26T11:00:00.000Z',
      approved_by: { name: 'Admin', email: 'admin@launchlog.ai' },
      exported_at: null,
      exported_by: null,
      export_count: 0,
      last_export_hash: null,
      requires_reexport_confirmation: false,
    })
    expect(controller.state.view.timing.expires_at).toBe(loadedCandidate.preview.expires_at)
    expect(controller.state.view.timing.expiry_valid).toBeTrue()

    controller.setDraftField('email_body', 'Dirty body')
    expect(controller.state.view.edits).toEqual({ prospect: 'clean', draft: 'dirty' })
    expect(controller.state.view.blockers.export).toContain('draft_not_clean')
    expect(controller.state.view.blockers.approve).toContain('draft_not_clean')

    const pending = deferred<Candidate | Recovery>()
    draftQueue.push(() => pending.promise)
    const saving = controller.saveDraft()
    expect(controller.state.view.action).toEqual({ name: 'save_draft', phase: 'pending' })
    for (const blockers of Object.values(controller.state.view.blockers)) {
      expect(blockers).toContain('action_pending')
    }
    pending.resolve(approved({ revision: 8 }))
    await saving
    expect(controller.state.view.action).toEqual(controller.state.action)
    expect(controller.state.view.edits.draft).toBe('clean')
    expect(controller.state.view.persisted).toBe('approved')
  })

  test('move through loading, success, and load-error without fabricated data', async () => {
    const pending = deferred<Candidate>()
    getQueue.push(() => pending.promise)
    const loading = controller.load()
    expect(controller.state.load).toBe('loading')
    expect(apiCalls).toHaveLength(1)
    pending.resolve(candidate())
    await loading

    expect(controller.state.load).toBe('ready')
    expect(controller.state.candidate).toEqual(candidate())
    expect(controller.state.prospect_form.business_email).toBe('ada@acme.test')
    expect(controller.state.draft_form.subject_line).toBe('A private preview for Acme')
    expect(controller.state.prospect_edit).toBe('clean')
    expect(controller.state.draft_edit).toBe('clean')

    controller = createController()
    getQueue.push(async () => { throw safeError('network') })
    await expect(controller.load()).rejects.toMatchObject({ kind: 'network' })
    expect(controller.state.load).toBe('load_error')
    expect(controller.state.candidate).toBeNull()
    expect(controller.state.load_error?.kind).toBe('network')
  })

  test('poll recursively every 1,800 ms without overlap and stop on terminal state', async () => {
    serverCandidate = generating()
    await controller.load()
    expect(controller.state.poll_active).toBeTrue()
    expect(activeTimers()).toHaveLength(1)
    expect(activeTimers()[0]?.delay).toBe(1800)

    const pendingPoll = deferred<Candidate>()
    getQueue.push(() => pendingPoll.promise)
    await fireNextTimer()
    expect(apiCalls.filter(call => call.name === 'getCandidate')).toHaveLength(2)
    expect(activeTimers()).toHaveLength(0)

    pendingPoll.resolve(generating({ revision: 8 }))
    await flushMicrotasks()
    expect(activeTimers()).toHaveLength(1)
    expect(activeTimers()[0]?.delay).toBe(1800)

    getQueue.push(async () => candidate({ revision: 9 }))
    await fireNextTimer()
    expect(controller.state.candidate?.effective_status).toBe('ready_for_review')
    expect(controller.state.poll_active).toBeFalse()
    expect(activeTimers()).toHaveLength(0)
    expect(apiCalls.filter(call => call.name !== 'getCandidate')).toEqual([])
  })

  test('continue after transient poll errors but stop at the original ten-minute deadline', async () => {
    serverCandidate = generating()
    await controller.load()
    getQueue.push(async () => { throw safeError('network') })
    await fireNextTimer()

    expect(controller.state.load).toBe('ready')
    expect(controller.state.poll_error?.kind).toBe('network')
    expect(activeTimers()).toHaveLength(1)
    expect(activeTimers()[0]?.delay).toBe(1800)

    nowMs = NOW_START + TEN_MINUTES
    const getCount = apiCalls.filter(call => call.name === 'getCandidate').length
    await fireNextTimer()
    expect(apiCalls.filter(call => call.name === 'getCandidate')).toHaveLength(getCount)
    expect(controller.state.poll_active).toBeFalse()
    expect(controller.state.poll_deadline_reached).toBeTrue()
    expect(activeTimers()).toHaveLength(0)
  })

  test('abort and invalidate a pending poll before manual refresh', async () => {
    serverCandidate = generating()
    await controller.load()
    const oldPoll = deferred<Candidate>()
    getQueue.push(() => oldPoll.promise)
    await fireNextTimer()
    const oldSignal = apiCalls.at(-1)?.transport?.signal

    getQueue.push(async () => candidate({ revision: 20 }))
    const refresh = controller.refresh()
    expect(oldSignal?.aborted).toBeTrue()
    await refresh
    oldPoll.resolve(generating({ revision: 99 }))
    await flushMicrotasks()

    expect(controller.state.candidate?.revision).toBe(20)
    expect(controller.state.poll_error).toBeNull()
    expect(activeTimers()).toHaveLength(0)
  })

  test('allow manual one-shot refresh after deadline without restarting the expired generation window', async () => {
    serverCandidate = generating()
    await controller.load()
    nowMs = NOW_START + TEN_MINUTES
    await fireNextTimer()
    expect(controller.state.poll_deadline_reached).toBeTrue()
    expect(controller.state.poll_active).toBeFalse()
    expect(activeTimers()).toHaveLength(0)

    getQueue.push(async () => generating({ revision: 8 }))
    const beforeFirst = apiCalls.length
    await controller.refresh()
    expect(apiCalls).toHaveLength(beforeFirst + 1)
    expect(controller.state.candidate?.revision).toBe(8)
    expect(controller.state.poll_deadline_reached).toBeTrue()
    expect(controller.state.poll_active).toBeFalse()
    expect(activeTimers()).toHaveLength(0)

    getQueue.push(async () => generating({ revision: 9 }))
    const beforeSecond = apiCalls.length
    await controller.refresh()
    expect(apiCalls).toHaveLength(beforeSecond + 1)
    expect(controller.state.candidate?.revision).toBe(9)
    expect(activeTimers()).toHaveLength(0)
  })

  test('preserve the original generation deadline across a pre-deadline manual refresh', async () => {
    serverCandidate = generating()
    await controller.load()
    nowMs = NOW_START + 5 * 60 * 1000
    getQueue.push(async () => generating({ revision: 8 }))
    await controller.refresh()
    expect(controller.state.poll_active).toBeTrue()
    expect(controller.state.poll_deadline_reached).toBeFalse()
    expect(activeTimers()).toHaveLength(1)

    nowMs = NOW_START + TEN_MINUTES - 1
    getQueue.push(async () => generating({ revision: 9 }))
    const beforeLastAllowedPoll = apiCalls.length
    await fireNextTimer()
    expect(apiCalls).toHaveLength(beforeLastAllowedPoll + 1)
    expect(controller.state.poll_active).toBeTrue()

    nowMs = NOW_START + TEN_MINUTES
    const beforeDeadline = apiCalls.length
    await fireNextTimer()
    expect(apiCalls).toHaveLength(beforeDeadline)
    expect(controller.state.poll_active).toBeFalse()
    expect(controller.state.poll_deadline_reached).toBeTrue()
  })

  test('resume after every definitive non-stale action error only inside the original deadline', async () => {
    const definitiveKinds: ErrorKind[] = [
      'validation',
      'conflict',
      'forbidden',
      'not_found',
      'unauthenticated',
      'rate_limited',
    ]

    for (const kind of definitiveKinds) {
      resetHarness(generating())
      await controller.load()
      nowMs = NOW_START + 5 * 60 * 1000
      controller.setDraftField('subject_line', `Definitive ${kind}`)
      draftQueue.push(async () => { throw safeError(kind) })
      await expect(controller.saveDraft()).rejects.toMatchObject({ kind })
      expect(controller.state.refresh_required).toBeFalse()
      expect(controller.state.poll_active).toBeTrue()
      expect(activeTimers()).toHaveLength(1)

      nowMs = NOW_START + TEN_MINUTES
      const beforeDeadline = apiCalls.length
      await fireNextTimer()
      expect(apiCalls).toHaveLength(beforeDeadline)
      expect(controller.state.poll_active).toBeFalse()
      expect(controller.state.poll_deadline_reached).toBeTrue()
    }
  })

  test('preserve the original generating window after campaign activation success or definitive error', async () => {
    const outcomes: Array<'success' | 'conflict'> = ['success', 'conflict']
    for (const outcome of outcomes) {
      resetHarness(generating({ campaign: { ...candidate().campaign, status: 'draft' } }))
      await controller.load()
      nowMs = NOW_START + 5 * 60 * 1000
      controller.setCampaignActivationConfirmed(true)
      if (outcome === 'success') {
        campaignQueue.push(async () => ({
          name: 'Founders active',
          key: 'founders-2026',
          status: 'active',
          sender_identity_label: 'Warmed founder domain',
          candidate_count: 1,
          created_at: '2026-08-25T10:00:00.000Z',
          updated_at: '2026-08-26T12:00:00.000Z',
        }))
        await controller.activateCampaign()
        expect(controller.state.candidate?.campaign.status).toBe('active')
      }
      else {
        campaignQueue.push(async () => { throw safeError('conflict') })
        await expect(controller.activateCampaign()).rejects.toMatchObject({ kind: 'conflict' })
        expect(controller.state.candidate?.campaign.status).toBe('draft')
      }
      expect(controller.state.refresh_required).toBeFalse()
      expect(controller.state.poll_active).toBeTrue()
      expect(activeTimers()).toHaveLength(1)

      nowMs = NOW_START + TEN_MINUTES
      const beforeDeadline = apiCalls.length
      await fireNextTimer()
      expect(apiCalls).toHaveLength(beforeDeadline)
      expect(controller.state.poll_active).toBeFalse()
      expect(controller.state.poll_deadline_reached).toBeTrue()
    }
  })

  test('start a fresh fixed ten-minute deadline after recapture and renew generation', async () => {
    const scenarios: Array<{
      initial: () => Candidate
      enqueue: (thunk: MutationThunk) => void
      invoke: () => Promise<void>
    }> = [
      {
        initial: () => candidate({
          persisted_status: 'draft',
          effective_status: 'failed',
          preview: { ...fixturePreview(), status: 'failed' },
        }),
        enqueue: thunk => recaptureQueue.push(thunk),
        invoke: () => controller.recapture(),
      },
      {
        initial: () => candidate({
          persisted_status: 'draft',
          effective_status: 'expired',
          preview: { ...fixturePreview(), status: 'expired', expires_at: '2026-08-25T12:00:00.000Z' },
        }),
        enqueue: thunk => renewQueue.push(thunk),
        invoke: () => controller.renew(),
      },
    ]

    const resultModes: Array<'full' | 'committed'> = ['full', 'committed']
    for (const scenario of scenarios) {
      for (const resultMode of resultModes) {
        resetHarness(scenario.initial())
        await controller.load()
        nowMs = NOW_START + 30 * 60 * 1000
        const generationStartedAt = nowMs
        if (resultMode === 'full') {
          scenario.enqueue(async () => generating({ revision: 8 }))
        }
        else {
          scenario.enqueue(async () => ({
            public_id: ULID,
            persistence_status: 'committed',
            recovery_url: `/api/v1/admin/outreach/candidates/${ULID}`,
          }))
          getQueue.push(async () => generating({ revision: 8 }))
        }
        await scenario.invoke()
        expect(controller.state.poll_active).toBeTrue()
        expect(controller.state.poll_deadline_reached).toBeFalse()
        expect(activeTimers()[0]?.delay).toBe(1800)

        nowMs = generationStartedAt + TEN_MINUTES - 1
        getQueue.push(async () => generating({ revision: 9 }))
        const beforeFinalPoll = apiCalls.length
        await fireNextTimer()
        expect(apiCalls).toHaveLength(beforeFinalPoll + 1)
        expect(controller.state.poll_active).toBeTrue()
        expect(activeTimers()).toHaveLength(1)

        nowMs = generationStartedAt + TEN_MINUTES
        const beforeDeadline = apiCalls.length
        await fireNextTimer()
        expect(apiCalls).toHaveLength(beforeDeadline)
        expect(controller.state.poll_active).toBeFalse()
        expect(controller.state.poll_deadline_reached).toBeTrue()
        expect(activeTimers()).toHaveLength(0)
      }
    }
  })

  test('drop late success, error, and finally writes after refresh, action, or disposal invalidates an epoch', async () => {
    type LateOutcome = 'success' | 'error'
    const outcomes: LateOutcome[] = ['success', 'error']
    const invalidators: Array<{
      name: 'refresh' | 'action' | 'dispose'
      invalidate: () => Promise<void>
    }> = [
      {
        name: 'refresh',
        invalidate: async () => {
          getQueue.push(async () => candidate({ revision: 20 }))
          await controller.refresh()
        },
      },
      {
        name: 'action',
        invalidate: async () => {
          controller.setCampaignActivationConfirmed(true)
          campaignQueue.push(async () => ({
            name: 'Founders active',
            key: 'founders-2026',
            status: 'active',
            sender_identity_label: 'Warm B',
            candidate_count: 1,
            created_at: '2026-08-25T10:00:00.000Z',
            updated_at: '2026-08-26T12:00:00.000Z',
          }))
          await controller.activateCampaign()
        },
      },
      {
        name: 'dispose',
        invalidate: async () => controller.dispose(),
      },
    ]

    for (const invalidator of invalidators) {
      for (const outcome of outcomes) {
        resetHarness(generating({ campaign: { ...candidate().campaign, status: 'draft' } }))
        await controller.load()
        const latePoll = deferred<Candidate>()
        getQueue.push(() => latePoll.promise)
        await fireNextTimer()
        const oldSignal = apiCalls.at(-1)?.transport?.signal
        await invalidator.invalidate()
        expect(oldSignal?.aborted).toBeTrue()
        const afterInvalidation = structuredClone(controller.state)
        const timerCount = activeTimers().length

        if (outcome === 'success') latePoll.resolve(generating({ revision: 99 }))
        else latePoll.reject(safeError('network'))
        await flushMicrotasks()

        expect(controller.state).toEqual(afterInvalidation)
        expect(activeTimers()).toHaveLength(timerCount)
        expect(controller.state.candidate?.revision ?? null).not.toBe(99)
        if (invalidator.name === 'dispose') expect(controller.state.candidate).toBeNull()
      }
    }
  })

  test('never clear refresh-required from a stale timer or failed explicit GET', async () => {
    resetHarness(generating({ campaign: { ...candidate().campaign, status: 'draft' } }))
    await controller.load()
    const staleTimer = activeTimers()[0]
    if (staleTimer === undefined) throw new Error('Expected the generating poll timer.')
    controller.setCampaignActivationConfirmed(true)
    campaignQueue.push(async () => { throw safeError('network') })
    await expect(controller.activateCampaign()).rejects.toMatchObject({ kind: 'network' })
    expect(controller.state.refresh_required).toBeTrue()
    expect(controller.state.poll_active).toBeFalse()

    const beforeStaleTimer = apiCalls.length
    staleTimer.callback()
    await flushMicrotasks()
    expect(apiCalls).toHaveLength(beforeStaleTimer)
    expect(controller.state.refresh_required).toBeTrue()

    getQueue.push(async () => { throw safeError('network') })
    await expect(controller.refresh()).rejects.toMatchObject({ kind: 'network' })
    expect(controller.state.refresh_required).toBeTrue()
    await expectEveryMutationBlockedWithoutApiCall()

    getQueue.push(async () => candidate({ revision: 21 }))
    await controller.refresh()
    expect(controller.state.refresh_required).toBeFalse()
    expect(controller.state.candidate?.revision).toBe(21)
  })
})

describe('dirty forms, confirmation binding, and full refresh', () => {
  test('synchronize both clean forms from a poll response', async () => {
    serverCandidate = generating()
    await controller.load()
    getQueue.push(async () => generating({
      revision: 8,
      prospect: { ...candidate().prospect, company_name: 'Server-polled company' },
      draft: { ...fixtureDraft(), email_body: 'SERVER_POLLED_BODY' },
    }))

    await fireNextTimer()

    expect(controller.state.prospect_form.company_name).toBe('Server-polled company')
    expect(controller.state.draft_form.email_body).toBe('SERVER_POLLED_BODY')
    expect(controller.state.prospect_edit).toBe('clean')
    expect(controller.state.draft_edit).toBe('clean')
  })

  test('preserve dirty forms and suppression draft across poll revision drift', async () => {
    serverCandidate = generating()
    await controller.load()
    controller.setProspectField('business_email', 'dirty-prospect@example.test')
    controller.setDraftField('email_body', 'DIRTY_DRAFT_SENTINEL')
    controller.setApprovalEnglishPlainText(true)
    controller.setApprovalPublicSource(true)
    controller.setReexportConfirmed(true)
    controller.setSuppressionTarget('email')
    controller.setSuppressionReason('DIRTY_SUPPRESSION_SENTINEL')
    controller.setSuppressionConfirmed(true)

    getQueue.push(async () => generating({
      revision: 8,
      prospect: { ...candidate().prospect, business_email: 'server@example.test' },
      draft: { ...fixtureDraft(), email_body: 'SERVER_DRAFT' },
    }))
    await fireNextTimer()

    expect(controller.state.candidate?.revision).toBe(8)
    expect(controller.state.prospect_form.business_email).toBe('dirty-prospect@example.test')
    expect(controller.state.draft_form.email_body).toBe('DIRTY_DRAFT_SENTINEL')
    expect(controller.state.prospect_edit).toBe('stale')
    expect(controller.state.draft_edit).toBe('stale')
    expect(controller.state.suppression_draft.reason).toBe('DIRTY_SUPPRESSION_SENTINEL')
    expect(controller.state.suppression_draft.confirmed).toBeFalse()
    expect(controller.state.suppression_draft.confirmed_revision).toBeNull()
    expect(controller.state.approval_english_plain_text).toBeFalse()
    expect(controller.state.approval_public_source).toBeFalse()
    expect(controller.state.reexport_confirmed).toBeFalse()
  })

  test('keep poll-stale prospect and draft forms immutable until an explicit full reload', async () => {
    const scenarios: Array<{
      section: 'prospect' | 'draft'
      prepare: () => void
      response: Candidate
      editAgain: () => void
      value: () => string
      save: () => Promise<void>
    }> = [
      {
        section: 'prospect',
        prepare: () => controller.setProspectField('company_name', 'STALE_PROSPECT_SENTINEL'),
        response: generating({ revision: 8, prospect: { ...candidate().prospect, company_name: 'SERVER_PROSPECT' } }),
        editAgain: () => controller.setProspectField('company_name', 'MUST_NOT_REPLACE_STALE_PROSPECT'),
        value: () => controller.state.prospect_form.company_name,
        save: () => controller.saveProspect(),
      },
      {
        section: 'draft',
        prepare: () => controller.setDraftField('email_body', 'STALE_DRAFT_SENTINEL'),
        response: generating({ revision: 8, draft: { ...fixtureDraft(), email_body: 'SERVER_DRAFT' } }),
        editAgain: () => controller.setDraftField('email_body', 'MUST_NOT_REPLACE_STALE_DRAFT'),
        value: () => controller.state.draft_form.email_body,
        save: () => controller.saveDraft(),
      },
    ]

    for (const scenario of scenarios) {
      resetHarness(generating())
      await controller.load()
      scenario.prepare()
      getQueue.push(async () => scenario.response)
      await fireNextTimer()

      const staleValue = scenario.value()
      const callsBefore = apiCalls.length
      scenario.editAgain()

      expect(scenario.section === 'prospect' ? controller.state.prospect_edit : controller.state.draft_edit).toBe('stale')
      expect(scenario.value()).toBe(staleValue)
      await expect(scenario.save()).rejects.toBeDefined()
      expect(apiCalls).toHaveLength(callsBefore)
    }
  })

  test('synchronize each clean form independently while preserving the dirty form during polling', async () => {
    const scenarios: Array<{
      dirty: 'prospect' | 'draft'
      prepare: () => void
      response: Candidate
    }> = [
      {
        dirty: 'prospect',
        prepare: () => controller.setProspectField('company_name', 'DIRTY_PROSPECT_ONLY'),
        response: generating({
          revision: 8,
          prospect: { ...candidate().prospect, company_name: 'SERVER_PROSPECT' },
          draft: { ...fixtureDraft(), email_body: 'SERVER_CLEAN_DRAFT' },
        }),
      },
      {
        dirty: 'draft',
        prepare: () => controller.setDraftField('email_body', 'DIRTY_DRAFT_ONLY'),
        response: generating({
          revision: 8,
          prospect: { ...candidate().prospect, company_name: 'SERVER_CLEAN_PROSPECT' },
          draft: { ...fixtureDraft(), email_body: 'SERVER_DRAFT' },
        }),
      },
    ]

    for (const scenario of scenarios) {
      resetHarness(generating())
      await controller.load()
      scenario.prepare()
      getQueue.push(async () => scenario.response)

      await fireNextTimer()

      expect(controller.state.candidate?.revision).toBe(8)
      if (scenario.dirty === 'prospect') {
        expect(controller.state.prospect_form.company_name).toBe('DIRTY_PROSPECT_ONLY')
        expect(controller.state.prospect_edit).toBe('stale')
        expect(controller.state.draft_form.email_body).toBe('SERVER_CLEAN_DRAFT')
        expect(controller.state.draft_edit).toBe('clean')
      }
      else {
        expect(controller.state.prospect_form.company_name).toBe('SERVER_CLEAN_PROSPECT')
        expect(controller.state.prospect_edit).toBe('clean')
        expect(controller.state.draft_form.email_body).toBe('DIRTY_DRAFT_ONLY')
        expect(controller.state.draft_edit).toBe('stale')
      }
    }
  })

  test('gate repeated load independently for each dirty route-local source', async () => {
    const scenarios: Array<{
      name: string
      prepare: () => void
      assertPreserved: () => void
    }> = [
      {
        name: 'prospect',
        prepare: () => controller.setProspectField('company_name', 'DIRTY_LOAD_PROSPECT'),
        assertPreserved: () => expect(controller.state.prospect_form.company_name).toBe('DIRTY_LOAD_PROSPECT'),
      },
      {
        name: 'draft',
        prepare: () => controller.setDraftField('email_body', 'DIRTY_LOAD_DRAFT'),
        assertPreserved: () => expect(controller.state.draft_form.email_body).toBe('DIRTY_LOAD_DRAFT'),
      },
      {
        name: 'suppression',
        prepare: () => controller.setSuppressionReason('DIRTY_LOAD_SUPPRESSION'),
        assertPreserved: () => expect(controller.state.suppression_draft.reason).toBe('DIRTY_LOAD_SUPPRESSION'),
      },
    ]

    for (const scenario of scenarios) {
      resetHarness()
      await controller.load()
      scenario.prepare()
      const callsBefore = apiCalls.length

      await controller.load()

      expect(apiCalls, scenario.name).toHaveLength(callsBefore)
      expect(controller.state.discard_confirmation_required, scenario.name).toBeTrue()
      scenario.assertPreserved()
      controller.cancelDiscardRefresh()
      expect(controller.state.discard_confirmation_required, scenario.name).toBeFalse()
    }
  })

  test('gate repeated load and refresh behind one confirm-or-cancel discard flow', async () => {
    await controller.load()
    controller.setProspectField('company_name', 'Dirty company')
    controller.setSuppressionReason('Dirty suppression reason')
    controller.setApprovalEnglishPlainText(true)
    controller.setApprovalPublicSource(true)
    controller.setCampaignActivationConfirmed(true)
    controller.setReexportConfirmed(true)
    const callsBefore = apiCalls.length

    await controller.refresh()
    await controller.load()
    expect(apiCalls).toHaveLength(callsBefore)
    expect(controller.state.discard_confirmation_required).toBeTrue()
    expect(controller.state.prospect_form.company_name).toBe('Dirty company')
    controller.cancelDiscardRefresh()
    expect(controller.state.discard_confirmation_required).toBeFalse()
    expect(controller.state.prospect_form.company_name).toBe('Dirty company')

    await controller.refresh()
    getQueue.push(async () => candidate({ revision: 12 }))
    await controller.confirmDiscardAndRefresh()
    expect(controller.state.candidate?.revision).toBe(12)
    expect(controller.state.prospect_form.company_name).toBe('Acme Labs')
    expect(controller.state.suppression_draft).toEqual({
      target: null,
      reason: '',
      source: 'manual',
      confirmed: false,
      confirmed_revision: null,
    })
    expect(controller.state.suppression_dirty).toBeFalse()
    expect(controller.state.approval_english_plain_text).toBeFalse()
    expect(controller.state.approval_public_source).toBeFalse()
    expect(controller.state.campaign_activation_confirmed).toBeFalse()
    expect(controller.state.reexport_confirmed).toBeFalse()
    expect(controller.state.discard_confirmation_required).toBeFalse()
  })

  test('reset approval and re-export confirmation after either form is edited', async () => {
    const editSections: Array<() => void> = [
      () => controller.setProspectField('company_name', 'Edited company'),
      () => controller.setDraftField('subject_line', 'Edited subject'),
    ]

    for (const editSection of editSections) {
      resetHarness()
      await controller.load()
      controller.setApprovalEnglishPlainText(true)
      controller.setApprovalPublicSource(true)
      controller.setReexportConfirmed(true)
      editSection()

      expect(controller.state.approval_english_plain_text).toBeFalse()
      expect(controller.state.approval_public_source).toBeFalse()
      expect(controller.state.reexport_confirmed).toBeFalse()
    }
  })
})

describe('revision-bound mutations and recovery', () => {
  test('save prospect with current revision and preserve a dirty other section as stale', async () => {
    await controller.load()
    controller.setProspectField('company_name', 'Acme Updated')
    controller.setDraftField('email_body', 'DIRTY_OTHER_DRAFT')
    prospectQueue.push(async () => candidate({
      revision: 11,
      prospect: { ...candidate().prospect, company_name: 'Acme Updated' },
      draft: { ...fixtureDraft(), email_body: 'SERVER_OTHER_DRAFT' },
    }))

    await controller.saveProspect()

    expect(apiCalls.at(-1)?.name).toBe('updateProspect')
    expect(apiCalls.at(-1)?.publicId).toBe(ULID)
    expect(apiCalls.at(-1)?.payload).toEqual({
      expected_revision: 7,
      source_attested: true,
      company_name: 'Acme Updated',
      product_name: 'Acme Launch',
      founder_first_name: 'Ada',
      business_email: 'ada@acme.test',
      country_code: 'US',
      source_url: 'https://directory.test/acme',
      source_context: 'Public founder profile.',
      notes: null,
    })
    expect(controller.state.candidate?.revision).toBe(11)
    expect(controller.state.prospect_edit).toBe('clean')
    expect(controller.state.prospect_form.company_name).toBe('Acme Updated')
    expect(controller.state.draft_edit).toBe('stale')
    expect(controller.state.draft_form.email_body).toBe('DIRTY_OTHER_DRAFT')
  })

  test('save draft with the exact current revision and exact form snapshot', async () => {
    await controller.load()
    controller.setDraftField('subject_line', 'Updated subject')
    controller.setDraftField('opening_line', 'Updated opening')
    controller.setDraftField('email_body', 'Updated body')
    draftQueue.push(async () => candidate({
      revision: 8,
      draft: {
        subject_line: 'Updated subject',
        opening_line: 'Updated opening',
        email_body: 'Updated body',
      },
    }))

    await controller.saveDraft()

    expect(apiCalls.at(-1)?.name).toBe('updateDraft')
    expect(apiCalls.at(-1)?.publicId).toBe(ULID)
    expect(apiCalls.at(-1)?.payload).toEqual({
      expected_revision: 7,
      subject_line: 'Updated subject',
      opening_line: 'Updated opening',
      email_body: 'Updated body',
    })
    expect(controller.state.candidate?.revision).toBe(8)
    expect(controller.state.draft_edit).toBe('clean')
  })

  test('synchronize a clean other section and preserve a dirty other section in both save directions', async () => {
    const otherSectionCases: Array<{ dirty: boolean, expectedValue: string, expectedEdit: EditState }> = [
      { dirty: false, expectedValue: 'SERVER_OTHER_DRAFT', expectedEdit: 'clean' },
      { dirty: true, expectedValue: 'LOCAL_OTHER_DRAFT', expectedEdit: 'stale' },
    ]
    for (const otherSectionCase of otherSectionCases) {
      resetHarness()
      await controller.load()
      controller.setProspectField('company_name', 'Saved prospect')
      if (otherSectionCase.dirty) controller.setDraftField('email_body', 'LOCAL_OTHER_DRAFT')
      prospectQueue.push(async () => candidate({
        revision: 8,
        prospect: { ...candidate().prospect, company_name: 'Saved prospect' },
        draft: { ...fixtureDraft(), email_body: 'SERVER_OTHER_DRAFT' },
      }))

      await controller.saveProspect()

      expect(controller.state.prospect_edit).toBe('clean')
      expect(controller.state.draft_form.email_body).toBe(otherSectionCase.expectedValue)
      expect(controller.state.draft_edit).toBe(otherSectionCase.expectedEdit)
    }

    const prospectCases: Array<{ dirty: boolean, expectedValue: string, expectedEdit: EditState }> = [
      { dirty: false, expectedValue: 'Server other prospect', expectedEdit: 'clean' },
      { dirty: true, expectedValue: 'Local other prospect', expectedEdit: 'stale' },
    ]
    for (const prospectCase of prospectCases) {
      resetHarness()
      await controller.load()
      controller.setDraftField('subject_line', 'Saved draft')
      if (prospectCase.dirty) controller.setProspectField('company_name', 'Local other prospect')
      draftQueue.push(async () => candidate({
        revision: 8,
        prospect: { ...candidate().prospect, company_name: 'Server other prospect' },
        draft: { ...fixtureDraft(), subject_line: 'Saved draft' },
      }))

      await controller.saveDraft()

      expect(controller.state.draft_edit).toBe('clean')
      expect(controller.state.prospect_form.company_name).toBe(prospectCase.expectedValue)
      expect(controller.state.prospect_edit).toBe(prospectCase.expectedEdit)
    }
  })

  test('use one validated GET for committed recovery and never fetch the returned URL', async () => {
    await controller.load()
    controller.setDraftField('subject_line', 'Recovered subject')
    draftQueue.push(async () => ({
      public_id: ULID,
      persistence_status: 'committed',
      recovery_url: `/api/v1/admin/outreach/candidates/${ULID}`,
    }))
    getQueue.push(async () => candidate({ revision: 9 }))

    await controller.saveDraft()

    expect(apiCalls.map(call => call.name)).toEqual(['getCandidate', 'updateDraft', 'getCandidate'])
    expect(apiCalls.at(-1)?.publicId).toBe(ULID)
    expect(controller.state.candidate?.revision).toBe(9)
    expect(controller.state.draft_edit).toBe('clean')
  })

  test('keep recovery-stale prospect and draft forms immutable and mutation-blocked', async () => {
    const committed: Recovery = {
      public_id: ULID,
      persistence_status: 'committed',
      recovery_url: `/api/v1/admin/outreach/candidates/${ULID}`,
    }
    const scenarios: Array<{
      section: 'prospect' | 'draft'
      prepare: () => void
      enqueueMutation: () => void
      recovered: Candidate
      invokeSubmittedSave: () => Promise<void>
      editAgain: () => void
      value: () => string
      saveStale: () => Promise<void>
    }> = [
      {
        section: 'prospect',
        prepare: () => {
          controller.setProspectField('company_name', 'RECOVERY_STALE_PROSPECT')
          controller.setDraftField('subject_line', 'Saved draft')
        },
        enqueueMutation: () => draftQueue.push(async () => committed),
        recovered: candidate({
          revision: 8,
          prospect: { ...candidate().prospect, company_name: 'SERVER_RECOVERED_PROSPECT' },
          draft: { ...fixtureDraft(), subject_line: 'Saved draft' },
        }),
        invokeSubmittedSave: () => controller.saveDraft(),
        editAgain: () => controller.setProspectField('company_name', 'MUST_NOT_REPLACE_RECOVERY_STALE_PROSPECT'),
        value: () => controller.state.prospect_form.company_name,
        saveStale: () => controller.saveProspect(),
      },
      {
        section: 'draft',
        prepare: () => {
          controller.setDraftField('email_body', 'RECOVERY_STALE_DRAFT')
          controller.setProspectField('company_name', 'Saved prospect')
        },
        enqueueMutation: () => prospectQueue.push(async () => committed),
        recovered: candidate({
          revision: 8,
          prospect: { ...candidate().prospect, company_name: 'Saved prospect' },
          draft: { ...fixtureDraft(), email_body: 'SERVER_RECOVERED_DRAFT' },
        }),
        invokeSubmittedSave: () => controller.saveProspect(),
        editAgain: () => controller.setDraftField('email_body', 'MUST_NOT_REPLACE_RECOVERY_STALE_DRAFT'),
        value: () => controller.state.draft_form.email_body,
        saveStale: () => controller.saveDraft(),
      },
    ]

    for (const scenario of scenarios) {
      resetHarness()
      await controller.load()
      scenario.prepare()
      scenario.enqueueMutation()
      getQueue.push(async () => scenario.recovered)
      await scenario.invokeSubmittedSave()

      const staleValue = scenario.value()
      const callsBefore = apiCalls.length
      scenario.editAgain()

      expect(scenario.section === 'prospect' ? controller.state.prospect_edit : controller.state.draft_edit).toBe('stale')
      expect(scenario.value()).toBe(staleValue)
      await expect(scenario.saveStale()).rejects.toBeDefined()
      expect(apiCalls).toHaveLength(callsBefore)
    }
  })

  test('handle full and committed recovery exactly once for every Task 8 mutation', async () => {
    const scenarios: Array<{
      initial: () => Candidate
      prepare: () => void
      enqueue: (thunk: MutationThunk) => void
      invoke: () => Promise<void>
      callName: keyof Api
      full: (revision: number) => Candidate
    }> = [
      {
        initial: () => candidate(),
        prepare: () => controller.setProspectField('company_name', 'Updated company'),
        enqueue: thunk => prospectQueue.push(thunk),
        invoke: () => controller.saveProspect(),
        callName: 'updateProspect',
        full: revision => candidate({ revision, prospect: { ...candidate().prospect, company_name: 'Updated company' } }),
      },
      {
        initial: () => candidate(),
        prepare: () => controller.setDraftField('subject_line', 'Updated subject'),
        enqueue: thunk => draftQueue.push(thunk),
        invoke: () => controller.saveDraft(),
        callName: 'updateDraft',
        full: revision => candidate({ revision, draft: { ...fixtureDraft(), subject_line: 'Updated subject' } }),
      },
      {
        initial: () => candidate(),
        prepare: () => {
          controller.setApprovalEnglishPlainText(true)
          controller.setApprovalPublicSource(true)
        },
        enqueue: thunk => approveQueue.push(thunk),
        invoke: () => controller.approve(),
        callName: 'approveCandidate',
        full: revision => approved({ revision }),
      },
      {
        initial: () => candidate({
          persisted_status: 'draft',
          effective_status: 'failed',
          preview: { ...fixturePreview(), status: 'failed' },
        }),
        prepare: () => undefined,
        enqueue: thunk => recaptureQueue.push(thunk),
        invoke: () => controller.recapture(),
        callName: 'recaptureCandidate',
        full: revision => generating({ revision }),
      },
      {
        initial: () => candidate({
          persisted_status: 'draft',
          effective_status: 'expired',
          preview: { ...fixturePreview(), status: 'expired', expires_at: '2026-08-25T12:00:00.000Z' },
        }),
        prepare: () => undefined,
        enqueue: thunk => renewQueue.push(thunk),
        invoke: () => controller.renew(),
        callName: 'renewCandidate',
        full: revision => generating({ revision }),
      },
    ]

    for (const scenario of scenarios) {
      resetHarness(scenario.initial())
      await controller.load()
      scenario.prepare()
      scenario.enqueue(async () => scenario.full(8))
      await scenario.invoke()
      expect(apiCalls.filter(call => call.name === scenario.callName)).toHaveLength(1)
      expect(apiCalls.filter(call => call.name === 'getCandidate')).toHaveLength(1)
      expect(controller.state.candidate?.revision).toBe(8)

      resetHarness(scenario.initial())
      await controller.load()
      scenario.prepare()
      scenario.enqueue(async () => ({
        public_id: ULID,
        persistence_status: 'committed',
        recovery_url: `/api/v1/admin/outreach/candidates/${ULID}`,
      }))
      getQueue.push(async () => scenario.full(9))
      await scenario.invoke()
      expect(apiCalls.filter(call => call.name === scenario.callName)).toHaveLength(1)
      expect(apiCalls.filter(call => call.name === 'getCandidate')).toHaveLength(2)
      expect(apiCalls.at(-1)?.name).toBe('getCandidate')
      expect(apiCalls.at(-1)?.publicId).toBe(ULID)
      expect(apiCalls.at(-1)?.key).toBeUndefined()
      expect(apiCalls.at(-1)?.payload).toBeUndefined()
      expect(controller.state.candidate?.revision).toBe(9)
    }
  })

  test('reject malformed or mismatched recovery for every Task 8 mutation without GET or replay', async () => {
    const scenarios: Array<{
      initial: () => Candidate
      prepare: () => void
      enqueue: (thunk: MutationThunk) => void
      invoke: () => Promise<void>
      callName: keyof Api
      malformed: Record<string, unknown>
    }> = [
      {
        initial: () => candidate(),
        prepare: () => controller.setProspectField('company_name', 'Updated company'),
        enqueue: thunk => prospectQueue.push(thunk),
        invoke: () => controller.saveProspect(),
        callName: 'updateProspect',
        malformed: {
          public_id: SECOND_ULID,
          persistence_status: 'committed',
          recovery_url: `/api/v1/admin/outreach/candidates/${SECOND_ULID}`,
        },
      },
      {
        initial: () => candidate(),
        prepare: () => controller.setDraftField('subject_line', 'Updated subject'),
        enqueue: thunk => draftQueue.push(thunk),
        invoke: () => controller.saveDraft(),
        callName: 'updateDraft',
        malformed: {
          public_id: ULID,
          persistence_status: 'committed',
          recovery_url: `/api/v1/admin/outreach/candidates/${SECOND_ULID}`,
        },
      },
      {
        initial: () => candidate(),
        prepare: () => {
          controller.setApprovalEnglishPlainText(true)
          controller.setApprovalPublicSource(true)
        },
        enqueue: thunk => approveQueue.push(thunk),
        invoke: () => controller.approve(),
        callName: 'approveCandidate',
        malformed: {
          public_id: ULID.toLowerCase(),
          persistence_status: 'committed',
          recovery_url: `/api/v1/admin/outreach/candidates/${ULID.toLowerCase()}`,
        },
      },
      {
        initial: () => candidate({
          persisted_status: 'draft',
          effective_status: 'failed',
          preview: { ...fixturePreview(), status: 'failed' },
        }),
        prepare: () => undefined,
        enqueue: thunk => recaptureQueue.push(thunk),
        invoke: () => controller.recapture(),
        callName: 'recaptureCandidate',
        malformed: {
          public_id: ULID,
          persistence_status: 'committed',
          recovery_url: `https://evil.test/api/v1/admin/outreach/candidates/${ULID}`,
        },
      },
      {
        initial: () => candidate({
          persisted_status: 'draft',
          effective_status: 'expired',
          preview: { ...fixturePreview(), status: 'expired', expires_at: '2026-08-25T12:00:00.000Z' },
        }),
        prepare: () => undefined,
        enqueue: thunk => renewQueue.push(thunk),
        invoke: () => controller.renew(),
        callName: 'renewCandidate',
        malformed: { public_id: ULID, persistence_status: 'committed' },
      },
    ]

    for (const scenario of scenarios) {
      resetHarness(scenario.initial())
      await controller.load()
      scenario.prepare()
      scenario.enqueue(async () => scenario.malformed)
      await expect(scenario.invoke()).rejects.toBeDefined()
      expect(controller.state.refresh_required).toBeTrue()
      expect(controller.state.candidate?.revision).toBe(7)
      expect(apiCalls.filter(call => call.name === scenario.callName)).toHaveLength(1)
      expect(apiCalls.filter(call => call.name === 'getCandidate')).toHaveLength(1)
      const count = apiCalls.length
      await expect(scenario.invoke()).rejects.toBeDefined()
      expect(apiCalls).toHaveLength(count)
    }
  })

  test('latch refresh-required after committed recovery GET failure', async () => {
    await controller.load()
    controller.setDraftField('subject_line', 'Recovered subject')
    draftQueue.push(async () => ({
      public_id: ULID,
      persistence_status: 'committed',
      recovery_url: `/api/v1/admin/outreach/candidates/${ULID}`,
    }))
    getQueue.push(async () => { throw safeError('network') })

    await expect(controller.saveDraft()).rejects.toMatchObject({ kind: 'network' })
    expect(controller.state.refresh_required).toBeTrue()
    expect(controller.state.prospect_edit).toBe('stale')
    expect(controller.state.draft_edit).toBe('stale')
    expect(controller.state.candidate?.revision).toBe(7)

    const callsBefore = apiCalls.length
    await expect(controller.saveDraft()).rejects.toBeDefined()
    expect(apiCalls).toHaveLength(callsBefore)
  })

  test('preserve last-good data on validation and mark both sections stale on exact stale revision', async () => {
    await controller.load()
    controller.setProspectField('company_name', 'Invalid company')
    prospectQueue.push(async () => { throw safeError('validation', { company_name: ['Check this field.'] }) })
    await expect(controller.saveProspect()).rejects.toMatchObject({ kind: 'validation' })
    expect(controller.state.candidate?.revision).toBe(7)
    expect(controller.state.prospect_form.company_name).toBe('Invalid company')
    expect(controller.state.validation_errors).toEqual({ company_name: ['Check this field.'] })
    expect(controller.state.prospect_edit).toBe('save_error')

    prospectQueue.push(async () => { throw safeError('stale_revision') })
    await expect(controller.saveProspect()).rejects.toMatchObject({ kind: 'stale_revision' })
    expect(controller.state.prospect_edit).toBe('stale')
    expect(controller.state.draft_edit).toBe('stale')
    expect(controller.state.candidate?.revision).toBe(7)
  })

  test('preserve save-error validation through same-revision polls and permit an exact-base retry', async () => {
    const scenarios: Array<{
      section: 'prospect' | 'draft'
      prepare: () => void
      enqueueValidation: () => void
      retrySuccess: Candidate
      enqueueRetry: () => void
      save: () => Promise<void>
      fieldErrors: Record<string, string[]>
    }> = [
      {
        section: 'prospect',
        prepare: () => controller.setProspectField('company_name', 'SAVE_ERROR_PROSPECT'),
        enqueueValidation: () => prospectQueue.push(async () => { throw safeError('validation', { company_name: ['Check this field.'] }) }),
        retrySuccess: generating({ revision: 8, prospect: { ...candidate().prospect, company_name: 'SAVE_ERROR_PROSPECT' } }),
        enqueueRetry: () => prospectQueue.push(async () => generating({
          revision: 8,
          prospect: { ...candidate().prospect, company_name: 'SAVE_ERROR_PROSPECT' },
        })),
        save: () => controller.saveProspect(),
        fieldErrors: { company_name: ['Check this field.'] },
      },
      {
        section: 'draft',
        prepare: () => controller.setDraftField('email_body', 'SAVE_ERROR_DRAFT'),
        enqueueValidation: () => draftQueue.push(async () => { throw safeError('validation', { email_body: ['Check this field.'] }) }),
        retrySuccess: generating({ revision: 8, draft: { ...fixtureDraft(), email_body: 'SAVE_ERROR_DRAFT' } }),
        enqueueRetry: () => draftQueue.push(async () => generating({
          revision: 8,
          draft: { ...fixtureDraft(), email_body: 'SAVE_ERROR_DRAFT' },
        })),
        save: () => controller.saveDraft(),
        fieldErrors: { email_body: ['Check this field.'] },
      },
    ]

    for (const scenario of scenarios) {
      resetHarness(generating())
      await controller.load()
      scenario.prepare()
      scenario.enqueueValidation()
      await expect(scenario.save()).rejects.toMatchObject({ kind: 'validation' })

      getQueue.push(async () => generating({ revision: 7, validation_errors: scenario.fieldErrors }))
      await fireNextTimer()

      expect(scenario.section === 'prospect' ? controller.state.prospect_edit : controller.state.draft_edit).toBe('save_error')
      expect(controller.state.validation_errors).toEqual(scenario.fieldErrors)

      scenario.enqueueRetry()
      await scenario.save()
      expect(controller.state.candidate).toEqual(scenario.retrySuccess)
      expect(scenario.section === 'prospect' ? controller.state.prospect_edit : controller.state.draft_edit).toBe('clean')
    }
  })

  test('promote save-error forms to stale on poll revision drift and block any retry', async () => {
    const scenarios: Array<{
      section: 'prospect' | 'draft'
      prepare: () => void
      enqueueValidation: () => void
      save: () => Promise<void>
    }> = [
      {
        section: 'prospect',
        prepare: () => controller.setProspectField('company_name', 'DRIFTED_SAVE_ERROR_PROSPECT'),
        enqueueValidation: () => prospectQueue.push(async () => { throw safeError('validation', { company_name: ['Check this field.'] }) }),
        save: () => controller.saveProspect(),
      },
      {
        section: 'draft',
        prepare: () => controller.setDraftField('email_body', 'DRIFTED_SAVE_ERROR_DRAFT'),
        enqueueValidation: () => draftQueue.push(async () => { throw safeError('validation', { email_body: ['Check this field.'] }) }),
        save: () => controller.saveDraft(),
      },
    ]

    for (const scenario of scenarios) {
      resetHarness(generating())
      await controller.load()
      scenario.prepare()
      scenario.enqueueValidation()
      await expect(scenario.save()).rejects.toMatchObject({ kind: 'validation' })

      getQueue.push(async () => generating({ revision: 8 }))
      await fireNextTimer()

      const callsBefore = apiCalls.length
      expect(scenario.section === 'prospect' ? controller.state.prospect_edit : controller.state.draft_edit).toBe('stale')
      await expect(scenario.save()).rejects.toBeDefined()
      expect(apiCalls).toHaveLength(callsBefore)
    }
  })

  test('sanitize structural validation errors before they enter controller state', async () => {
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
      'prospect_public_ids.0',
      'prospect_public_ids.1',
    ]
    const remoteFields: Record<string, string[]> = {}
    for (const field of [...allowed].reverse()) remoteFields[field] = [`RAW_${field}_PII`]
    remoteFields.arbitrary_private_field = ['RAW_ARBITRARY_PII']
    const structuralDetails: {
      name: string
      kind: ErrorKind
      status: number
      fieldErrors: Record<string, string[]>
      cause: { name: string, message: string }
      request: { authorization: string }
    } = {
      name: 'FetchError',
      kind: 'validation',
      status: 422,
      fieldErrors: remoteFields,
      cause: { name: 'RemoteCause', message: 'RAW_CAUSE_PII' },
      request: { authorization: 'RAW_TOKEN_PII' },
    }
    const structuralError: SafeError & {
      cause: { name: string, message: string }
      request: { authorization: string }
    } = Object.assign(new Error('RAW_TOP_LEVEL_PII'), structuralDetails)

    await controller.load()
    controller.setProspectField('company_name', 'Invalid company')
    prospectQueue.push(async () => { throw structuralError })

    await expect(controller.saveProspect()).rejects.toMatchObject({
      kind: 'validation',
      message: 'Check the highlighted fields.',
    })

    expect(Object.keys(controller.state.validation_errors)).toEqual(allowed.slice(0, 32))
    expect(controller.state.action_error?.fieldErrors).toEqual(controller.state.validation_errors)
    for (const messages of Object.values(controller.state.validation_errors)) {
      expect(messages).toEqual(['Check this field.'])
    }
    const serialized = JSON.stringify(controller.state)
    expect(serialized).not.toContain('RAW_')
    expect(serialized).not.toContain('arbitrary_private_field')
  })

  test('allow only suppression after archive or conversion and keep every other candidate mutation local', async () => {
    const scenarios: Array<{ initial: Candidate, blocker: string }> = [
      {
        initial: candidate({ campaign: { ...candidate().campaign, status: 'archived' } }),
        blocker: 'campaign_archived',
      },
      {
        initial: approved({ effective_status: 'converted' }),
        blocker: 'converted',
      },
    ]

    for (const scenario of scenarios) {
      resetHarness(scenario.initial)
      await controller.load()
      controller.setProspectField('company_name', 'Blocked company edit')
      controller.setDraftField('subject_line', 'Blocked draft edit')
      controller.setApprovalEnglishPlainText(true)
      controller.setApprovalPublicSource(true)
      controller.setCampaignActivationConfirmed(true)
      controller.setReexportConfirmed(true)

      const blocked: Array<() => Promise<unknown>> = [
        () => controller.saveProspect(),
        () => controller.saveDraft(),
        () => controller.approve(),
        () => controller.recapture(),
        () => controller.renew(),
        () => controller.activateCampaign(),
        () => controller.exportCandidate(),
      ]
      const beforeBlocked = apiCalls.length
      for (const invoke of blocked) {
        await expect(invoke()).rejects.toBeDefined()
      }
      expect(apiCalls).toHaveLength(beforeBlocked)
      expect(controller.state.view.blockers.export).toContain(scenario.blocker)

      controller.setSuppressionTarget('email')
      controller.setSuppressionReason('Allowed terminal suppression')
      controller.setSuppressionSource('manual')
      controller.setSuppressionConfirmed(true)
      suppressionQueue.push(async () => ({
        kind: 'email',
        value: 'ada@acme.test',
        reason: 'Allowed terminal suppression',
        source: 'manual',
        created_by: null,
        created_at: '2026-08-26T12:00:00.000Z',
        updated_at: '2026-08-26T12:00:00.000Z',
      }))
      getQueue.push(async () => ({ ...scenario.initial, revision: 8 }))
      await controller.suppress()
      expect(apiCalls.slice(-2).map(call => call.name)).toEqual(['createSuppression', 'getCandidate'])
    }
  })

  test('refuse terminal archived and converted states for otherwise eligible review actions', async () => {
    const failedPreview = fixturePreview()
    const expiredPreview = fixturePreview()
    const actions: Array<{
      name: string
      initial: Candidate
      prepare: () => void
      invoke: () => Promise<unknown>
      apiName: keyof Api
    }> = [
      {
        name: 'approve',
        initial: candidate(),
        prepare: () => {
          controller.setApprovalEnglishPlainText(true)
          controller.setApprovalPublicSource(true)
        },
        invoke: () => controller.approve(),
        apiName: 'approveCandidate',
      },
      {
        name: 'export',
        initial: approved(),
        prepare: () => {},
        invoke: () => controller.exportCandidate(),
        apiName: 'exportCandidates',
      },
      {
        name: 'recapture',
        initial: candidate({
          effective_status: 'failed',
          failure: { code: 'capture_failed', message: 'Preview capture failed.' },
          preview: {
            ...failedPreview,
            status: 'failed',
            error: { code: 'capture_failed', message: 'Preview capture failed.' },
          },
        }),
        prepare: () => {},
        invoke: () => controller.recapture(),
        apiName: 'recaptureCandidate',
      },
      {
        name: 'renew',
        initial: candidate({
          effective_status: 'expired',
          preview: {
            ...expiredPreview,
            status: 'expired',
            expires_at: '2026-08-26T11:59:59.999Z',
          },
        }),
        prepare: () => {},
        invoke: () => controller.renew(),
        apiName: 'renewCandidate',
      },
    ]

    for (const terminal of ['archived', 'converted'] as const) {
      for (const action of actions) {
        const initial = terminal === 'archived'
          ? { ...action.initial, campaign: { ...action.initial.campaign, status: 'archived' as const } }
          : { ...action.initial, effective_status: 'converted' as const }
        resetHarness(initial)
        await controller.load()
        action.prepare()
        const callsBefore = apiCalls.length

        await expect(action.invoke()).rejects.toBeDefined()

        expect(apiCalls, `${terminal}:${action.name}`).toHaveLength(callsBefore)
        expect(apiCalls.filter(call => call.name === action.apiName), `${terminal}:${action.name}`).toHaveLength(0)
        const blockers = action.name === 'approve'
          ? controller.state.view.blockers.approve
          : action.name === 'export'
            ? controller.state.view.blockers.export
            : action.name === 'recapture'
              ? controller.state.view.blockers.recapture
              : controller.state.view.blockers.renew
        expect(blockers, `${terminal}:${action.name}`).toContain(terminal === 'archived' ? 'campaign_archived' : 'converted')
      }
    }
  })

  test('block every later mutation after an exact stale revision with zero API calls', async () => {
    resetHarness(candidate({ campaign: { ...candidate().campaign, status: 'draft' } }))
    await controller.load()
    controller.setProspectField('company_name', 'Stale company')
    controller.setDraftField('subject_line', 'Stale subject')
    controller.setApprovalEnglishPlainText(true)
    controller.setApprovalPublicSource(true)
    controller.setCampaignActivationConfirmed(true)
    controller.setSuppressionTarget('email')
    controller.setSuppressionReason('Stale suppression')
    controller.setSuppressionConfirmed(true)
    prospectQueue.push(async () => { throw safeError('stale_revision') })
    await expect(controller.saveProspect()).rejects.toMatchObject({ kind: 'stale_revision' })

    expect(controller.state.prospect_edit).toBe('stale')
    expect(controller.state.draft_edit).toBe('stale')
    await expectEveryMutationBlockedWithoutApiCall()
  })

  test('refuse active, archived, unconfirmed, and concurrent campaign activation without another API call', async () => {
    const refusedStatuses: CampaignStatus[] = ['active', 'archived']
    for (const status of refusedStatuses) {
      resetHarness(candidate({ campaign: { ...candidate().campaign, status } }))
      await controller.load()
      controller.setCampaignActivationConfirmed(true)
      const before = apiCalls.length
      await expect(controller.activateCampaign()).rejects.toBeDefined()
      expect(apiCalls).toHaveLength(before)
    }

    resetHarness(candidate({ campaign: { ...candidate().campaign, status: 'draft' } }))
    await controller.load()
    const beforeUnconfirmed = apiCalls.length
    await expect(controller.activateCampaign()).rejects.toBeDefined()
    expect(apiCalls).toHaveLength(beforeUnconfirmed)

    controller.setCampaignActivationConfirmed(true)
    controller.setDraftField('subject_line', 'Pending draft')
    const pending = deferred<Candidate>()
    draftQueue.push(() => pending.promise)
    const save = controller.saveDraft()
    const beforeConcurrent = apiCalls.length
    await expect(controller.activateCampaign()).rejects.toBeDefined()
    expect(apiCalls).toHaveLength(beforeConcurrent)
    pending.resolve(candidate({
      revision: 8,
      campaign: { ...candidate().campaign, status: 'draft' },
      draft: { ...fixtureDraft(), subject_line: 'Pending draft' },
    }))
    await save
  })

  test('latch uncertain PATCH/POST outcomes and allow only explicit successful GET to clear it', async () => {
    const uncertainMethods: Array<{
      prepare: () => void
      invoke: () => Promise<unknown>
      queue: MutationThunk[] | CampaignThunk[] | SuppressionThunk[] | ExportThunk[]
      dirty: boolean
    }> = [
      {
        prepare: () => controller.setProspectField('company_name', 'Changed'),
        invoke: () => controller.saveProspect(),
        queue: prospectQueue,
        dirty: true,
      },
      {
        prepare: () => {
          controller.setApprovalEnglishPlainText(true)
          controller.setApprovalPublicSource(true)
        },
        invoke: () => controller.approve(),
        queue: approveQueue,
        dirty: false,
      },
    ]

    for (const scenario of uncertainMethods) {
      controller = createController()
      apiCalls = []
      await controller.load()
      scenario.prepare()
      scenario.queue.push(async () => { throw safeError('network') })
      await expect(scenario.invoke()).rejects.toMatchObject({ kind: 'network' })
      expect(controller.state.refresh_required).toBeTrue()
      const callsBefore = apiCalls.length
      await expect(scenario.invoke()).rejects.toBeDefined()
      expect(apiCalls).toHaveLength(callsBefore)

      getQueue.push(async () => candidate({ revision: 10 }))
      if (scenario.dirty) {
        const callsBeforeRefresh = apiCalls.length
        await controller.refresh()
        expect(apiCalls).toHaveLength(callsBeforeRefresh)
        expect(controller.state.discard_confirmation_required).toBeTrue()
        expect(controller.state.refresh_required).toBeTrue()
        await controller.confirmDiscardAndRefresh()
      }
      else {
        await controller.refresh()
      }
      expect(controller.state.refresh_required).toBeFalse()
      expect(controller.state.candidate?.revision).toBe(10)
    }
  })

  test('latch network, server, malformed-success, and live-abort outcomes for every mutation surface', async () => {
    type Outcome = 'network' | 'server' | 'malformed' | 'aborted'
    const outcomes: Outcome[] = ['network', 'server', 'malformed', 'aborted']
    const scenarios: Array<{
      initial: () => Candidate
      prepare: () => void
      enqueue: (thunk: () => Promise<unknown>) => void
      invoke: () => Promise<unknown>
      callName: keyof Api
      malformed: Record<string, unknown>
      dirty: boolean
    }> = [
      {
        initial: () => candidate(),
        prepare: () => controller.setProspectField('company_name', 'UNCERTAIN_PROSPECT_SENTINEL'),
        enqueue: thunk => prospectQueue.push(thunk),
        invoke: () => controller.saveProspect(),
        callName: 'updateProspect',
        malformed: { data: 'not-a-candidate' },
        dirty: true,
      },
      {
        initial: () => candidate(),
        prepare: () => controller.setDraftField('email_body', 'UNCERTAIN_DRAFT_SENTINEL'),
        enqueue: thunk => draftQueue.push(thunk),
        invoke: () => controller.saveDraft(),
        callName: 'updateDraft',
        malformed: { public_id: ULID, revision: 'not-an-integer' },
        dirty: true,
      },
      {
        initial: () => candidate(),
        prepare: () => {
          controller.setApprovalEnglishPlainText(true)
          controller.setApprovalPublicSource(true)
        },
        enqueue: thunk => approveQueue.push(thunk),
        invoke: () => controller.approve(),
        callName: 'approveCandidate',
        malformed: { public_id: ULID, persisted_status: 'approved' },
        dirty: false,
      },
      {
        initial: () => candidate({
          persisted_status: 'draft',
          effective_status: 'failed',
          preview: { ...fixturePreview(), status: 'failed' },
        }),
        prepare: () => undefined,
        enqueue: thunk => recaptureQueue.push(thunk),
        invoke: () => controller.recapture(),
        callName: 'recaptureCandidate',
        malformed: { status: 'generating' },
        dirty: false,
      },
      {
        initial: () => candidate({
          persisted_status: 'draft',
          effective_status: 'expired',
          preview: { ...fixturePreview(), status: 'expired', expires_at: '2026-08-25T12:00:00.000Z' },
        }),
        prepare: () => undefined,
        enqueue: thunk => renewQueue.push(thunk),
        invoke: () => controller.renew(),
        callName: 'renewCandidate',
        malformed: { persistence_status: 'committed', public_id: ULID },
        dirty: false,
      },
      {
        initial: () => generating({ campaign: { ...candidate().campaign, status: 'draft' } }),
        prepare: () => controller.setCampaignActivationConfirmed(true),
        enqueue: thunk => campaignQueue.push(thunk),
        invoke: () => controller.activateCampaign(),
        callName: 'updateCampaign',
        malformed: { name: 'Missing required campaign resource fields' },
        dirty: false,
      },
      {
        initial: () => candidate(),
        prepare: () => {
          controller.setSuppressionTarget('email')
          controller.setSuppressionReason('UNCERTAIN_SUPPRESSION_SENTINEL')
          controller.setSuppressionConfirmed(true)
        },
        enqueue: thunk => suppressionQueue.push(thunk),
        invoke: () => controller.suppress(),
        callName: 'createSuppression',
        malformed: { kind: 'email', value: 'missing-resource-fields' },
        dirty: true,
      },
      {
        initial: () => approved(),
        prepare: () => undefined,
        enqueue: thunk => exportQueue.push(thunk),
        invoke: () => controller.exportCandidate(),
        callName: 'exportCandidates',
        malformed: { blob: 'not-a-blob', filename: '../unsafe.csv' },
        dirty: false,
      },
    ]

    for (const scenario of scenarios) {
      for (const outcome of outcomes) {
        resetHarness(scenario.initial())
        await controller.load()
        scenario.prepare()
        const lastGoodCandidate = structuredClone(controller.state.candidate)
        const lastProspect = structuredClone(controller.state.prospect_form)
        const lastDraft = structuredClone(controller.state.draft_form)
        const lastSuppression = structuredClone(controller.state.suppression_draft)

        if (outcome === 'network' || outcome === 'server') {
          scenario.enqueue(async () => { throw safeError(outcome) })
          await expect(scenario.invoke()).rejects.toMatchObject({ kind: outcome })
        }
        else if (outcome === 'malformed') {
          scenario.enqueue(async () => scenario.malformed)
          await expect(scenario.invoke()).rejects.toBeDefined()
        }
        else {
          const pending = deferred<unknown>()
          scenario.enqueue(() => pending.promise)
          const operation = scenario.invoke()
          await flushMicrotasks()
          const signal = apiCalls.filter(call => call.name === scenario.callName).at(-1)?.transport?.signal
          const requestController = abortControllers.find(abortController => abortController.signal === signal)
          expect(requestController).toBeDefined()
          requestController?.abort()
          pending.reject(safeError('aborted'))
          await expect(operation).rejects.toMatchObject({ kind: 'aborted' })
        }

        expect(apiCalls.filter(call => call.name === scenario.callName)).toHaveLength(1)
        expect(controller.state.refresh_required).toBeTrue()
        expect(controller.state.poll_active).toBeFalse()
        expect(controller.state.candidate).toEqual(lastGoodCandidate)
        expect(controller.state.prospect_form).toEqual(lastProspect)
        expect(controller.state.draft_form).toEqual(lastDraft)
        expect(controller.state.suppression_draft).toEqual(lastSuppression)
        expect(controller.state.view.refresh_required).toBeTrue()
        for (const blockers of Object.values(controller.state.view.blockers)) {
          expect(blockers).toContain('refresh_required')
        }
        await expectEveryMutationBlockedWithoutApiCall()

        getQueue.push(async () => candidate({ revision: 10 }))
        if (scenario.dirty) {
          const beforeRefresh = apiCalls.length
          await controller.refresh()
          expect(apiCalls).toHaveLength(beforeRefresh)
          expect(controller.state.discard_confirmation_required).toBeTrue()
          expect(controller.state.refresh_required).toBeTrue()
          await controller.confirmDiscardAndRefresh()
        }
        else {
          await controller.refresh()
        }
        expect(controller.state.refresh_required).toBeFalse()
        expect(controller.state.candidate?.revision).toBe(10)
      }
    }
  })
})

describe('committed mutation follow-up refresh failures', () => {
  test('latch every candidate, suppression, and export follow-up GET failure without replay', async () => {
    const scenarios: Array<{
      initial: () => Candidate
      prepare: () => void
      enqueueSuccess: () => void
      invoke: () => Promise<unknown>
      callName: keyof Api
      dirtyAfterCommit: boolean
      returnsDownload: boolean
    }> = [
      {
        initial: () => candidate(),
        prepare: () => controller.setProspectField('company_name', 'Committed prospect'),
        enqueueSuccess: () => prospectQueue.push(async () => ({
          public_id: ULID,
          persistence_status: 'committed',
          recovery_url: `/api/v1/admin/outreach/candidates/${ULID}`,
        })),
        invoke: () => controller.saveProspect(),
        callName: 'updateProspect',
        dirtyAfterCommit: true,
        returnsDownload: false,
      },
      {
        initial: () => candidate(),
        prepare: () => controller.setDraftField('subject_line', 'Committed draft'),
        enqueueSuccess: () => draftQueue.push(async () => ({
          public_id: ULID,
          persistence_status: 'committed',
          recovery_url: `/api/v1/admin/outreach/candidates/${ULID}`,
        })),
        invoke: () => controller.saveDraft(),
        callName: 'updateDraft',
        dirtyAfterCommit: true,
        returnsDownload: false,
      },
      {
        initial: () => candidate(),
        prepare: () => {
          controller.setApprovalEnglishPlainText(true)
          controller.setApprovalPublicSource(true)
        },
        enqueueSuccess: () => approveQueue.push(async () => ({
          public_id: ULID,
          persistence_status: 'committed',
          recovery_url: `/api/v1/admin/outreach/candidates/${ULID}`,
        })),
        invoke: () => controller.approve(),
        callName: 'approveCandidate',
        dirtyAfterCommit: false,
        returnsDownload: false,
      },
      {
        initial: () => candidate({
          persisted_status: 'draft',
          effective_status: 'failed',
          preview: { ...fixturePreview(), status: 'failed' },
        }),
        prepare: () => undefined,
        enqueueSuccess: () => recaptureQueue.push(async () => ({
          public_id: ULID,
          persistence_status: 'committed',
          recovery_url: `/api/v1/admin/outreach/candidates/${ULID}`,
        })),
        invoke: () => controller.recapture(),
        callName: 'recaptureCandidate',
        dirtyAfterCommit: false,
        returnsDownload: false,
      },
      {
        initial: () => candidate({
          persisted_status: 'draft',
          effective_status: 'expired',
          preview: { ...fixturePreview(), status: 'expired', expires_at: '2026-08-25T12:00:00.000Z' },
        }),
        prepare: () => undefined,
        enqueueSuccess: () => renewQueue.push(async () => ({
          public_id: ULID,
          persistence_status: 'committed',
          recovery_url: `/api/v1/admin/outreach/candidates/${ULID}`,
        })),
        invoke: () => controller.renew(),
        callName: 'renewCandidate',
        dirtyAfterCommit: false,
        returnsDownload: false,
      },
      {
        initial: () => candidate(),
        prepare: () => {
          controller.setSuppressionTarget('email')
          controller.setSuppressionReason('Committed suppression')
          controller.setSuppressionConfirmed(true)
        },
        enqueueSuccess: () => suppressionQueue.push(async () => ({
          kind: 'email',
          value: 'ada@acme.test',
          reason: 'Committed suppression',
          source: 'manual',
          created_by: null,
          created_at: '2026-08-26T12:00:00.000Z',
          updated_at: '2026-08-26T12:00:00.000Z',
        })),
        invoke: () => controller.suppress(),
        callName: 'createSuppression',
        dirtyAfterCommit: false,
        returnsDownload: false,
      },
      {
        initial: () => approved(),
        prepare: () => undefined,
        enqueueSuccess: () => exportQueue.push(async () => ({
          blob: new Blob(['FOLLOW_UP_DOWNLOAD_SENTINEL']),
          filename: 'launchlog-outreach-founders-2026.csv',
        })),
        invoke: () => controller.exportCandidate(),
        callName: 'exportCandidates',
        dirtyAfterCommit: false,
        returnsDownload: true,
      },
    ]

    const followUpKinds: ErrorKind[] = ['network', 'server']
    for (const scenario of scenarios) {
      for (const kind of followUpKinds) {
        resetHarness(scenario.initial())
        await controller.load()
        scenario.prepare()
        const lastGood = structuredClone(controller.state.candidate)
        scenario.enqueueSuccess()
        getQueue.push(async () => { throw safeError(kind) })

        if (scenario.returnsDownload) {
          const result = await scenario.invoke()
          expect(result).toMatchObject({ filename: 'launchlog-outreach-founders-2026.csv' })
        }
        else {
          await expect(scenario.invoke()).rejects.toMatchObject({ kind })
        }

        expect(apiCalls.filter(call => call.name === scenario.callName)).toHaveLength(1)
        expect(apiCalls.filter(call => call.name === 'getCandidate')).toHaveLength(2)
        expect(controller.state.refresh_required).toBeTrue()
        expect(controller.state.candidate).toEqual(lastGood)
        expect(controller.state.poll_active).toBeFalse()
        await expectEveryMutationBlockedWithoutApiCall()

        getQueue.push(async () => candidate({ revision: 15 }))
        if (scenario.dirtyAfterCommit) {
          const beforeRefresh = apiCalls.length
          await controller.refresh()
          expect(apiCalls).toHaveLength(beforeRefresh)
          expect(controller.state.discard_confirmation_required).toBeTrue()
          await controller.confirmDiscardAndRefresh()
        }
        else {
          await controller.refresh()
        }
        expect(controller.state.refresh_required).toBeFalse()
        expect(controller.state.candidate?.revision).toBe(15)
      }
    }
  })
})

describe('approval, lifecycle, suppression, and export actions', () => {
  test('approve only with both literals and the current returned revision', async () => {
    await controller.load()
    const callsBefore = apiCalls.length
    await expect(controller.approve()).rejects.toBeDefined()
    expect(apiCalls).toHaveLength(callsBefore)

    resetHarness(candidate({ effective_status: 'failed' }))
    await controller.load()
    controller.setApprovalEnglishPlainText(true)
    controller.setApprovalPublicSource(true)
    const beforeNonReadyApproval = apiCalls.length
    expect(controller.state.view.blockers.approve).toContain('approval_not_available')
    await expect(controller.approve()).rejects.toBeDefined()
    expect(apiCalls).toHaveLength(beforeNonReadyApproval)

    resetHarness()
    await controller.load()
    controller.setApprovalEnglishPlainText(true)
    controller.setApprovalPublicSource(true)
    approveQueue.push(async () => approved({ revision: 8 }))
    await controller.approve()
    expect(apiCalls.at(-1)?.name).toBe('approveCandidate')
    expect(apiCalls.at(-1)?.publicId).toBe(ULID)
    expect(apiCalls.at(-1)?.payload).toEqual({
      expected_revision: 7,
      confirm_english_plain_text: true,
      confirm_public_source: true,
    })
    expect(controller.state.candidate?.revision).toBe(8)
    expect(controller.state.approval_english_plain_text).toBeFalse()
    expect(controller.state.approval_public_source).toBeFalse()
  })

  test('activate only a confirmed draft campaign and project the nested campaign shape', async () => {
    serverCandidate = candidate({
      campaign: { ...candidate().campaign, status: 'draft' },
    })
    await controller.load()
    const before = apiCalls.length
    await expect(controller.activateCampaign()).rejects.toBeDefined()
    expect(apiCalls).toHaveLength(before)

    controller.setCampaignActivationConfirmed(true)
    campaignQueue.push(async () => ({
      name: 'Founders active',
      key: 'founders-2026',
      status: 'active',
      sender_identity_label: 'Warmed founder domain B',
      candidate_count: 99,
      created_at: '2020-01-01T00:00:00.000Z',
      updated_at: '2026-08-26T12:00:00.000Z',
    }))
    await controller.activateCampaign()

    expect(apiCalls.at(-1)?.name).toBe('updateCampaign')
    expect(apiCalls.at(-1)?.key).toBe('founders-2026')
    expect(apiCalls.at(-1)?.payload).toEqual({ status: 'active' })
    expect(controller.state.candidate?.campaign).toEqual({
      name: 'Founders active',
      key: 'founders-2026',
      status: 'active',
      sender_identity_label: 'Warmed founder domain B',
    })
    expect(controller.state.candidate?.revision).toBe(7)
    expect(controller.state.campaign_activation_confirmed).toBeFalse()
  })

  test('reject malformed campaign literals without projecting uncertain mutation data', async () => {
    const initial = candidate({ campaign: { ...candidate().campaign, status: 'draft' } })
    resetHarness(initial)
    await controller.load()
    controller.setCampaignActivationConfirmed(true)
    campaignQueue.push(async () => ({
      name: 'Invalid campaign response',
      key: 'founders-2026',
      status: 'paused',
      sender_identity_label: 'Warmed founder domain',
      candidate_count: 1,
      created_at: '2026-08-25T10:00:00.000Z',
      updated_at: '2026-08-26T12:00:00.000Z',
      forbidden_campaign: 'RAW_CAMPAIGN_PII',
    }))

    await expect(controller.activateCampaign()).rejects.toMatchObject({ kind: 'server' })
    expect(controller.state.candidate?.campaign).toEqual(initial.campaign)
    expect(controller.state.refresh_required).toBeTrue()
    expect(JSON.stringify(controller.state)).not.toContain('RAW_CAMPAIGN_PII')
  })

  test('recapture and renew with exact empty transport-only calls', async () => {
    serverCandidate = candidate({ effective_status: 'failed', persisted_status: 'draft', preview: {
      ...fixturePreview(),
      status: 'failed',
    } })
    await controller.load()
    recaptureQueue.push(async () => generating({ revision: 8 }))
    await controller.recapture()
    expect(apiCalls.at(-1)?.name).toBe('recaptureCandidate')
    expect(apiCalls.at(-1)?.payload).toBeUndefined()
    expect(controller.state.poll_active).toBeTrue()
    expect(activeTimers()[0]?.delay).toBe(1800)

    controller.dispose()
    timers = []
    serverCandidate = candidate({ effective_status: 'expired', persisted_status: 'draft', preview: {
      ...fixturePreview(),
      status: 'expired',
      expires_at: '2026-08-25T12:00:00.000Z',
    } })
    controller = createController()
    await controller.load()
    renewQueue.push(async () => generating({ revision: 9 }))
    await controller.renew()
    expect(apiCalls.at(-1)?.name).toBe('renewCandidate')
    expect(apiCalls.at(-1)?.payload).toBeUndefined()
    expect(controller.state.poll_active).toBeTrue()
  })

  test('bind suppression confirmation only to semantic draft changes and exact reason boundaries', async () => {
    await controller.load()
    controller.setSuppressionTarget('email')
    controller.setSuppressionReason('  Same reason  ')
    controller.setSuppressionSource('manual')
    controller.setSuppressionConfirmed(true)
    expect(controller.state.suppression_draft.confirmed).toBeTrue()
    expect(controller.state.suppression_draft.confirmed_revision).toBe(7)
    expect(controller.state.suppression_dirty).toBeTrue()

    controller.setSuppressionTarget('email')
    controller.setSuppressionReason('Same reason')
    controller.setSuppressionSource('manual')
    expect(controller.state.suppression_draft.confirmed).toBeTrue()
    expect(controller.state.suppression_draft.confirmed_revision).toBe(7)

    controller.setSuppressionTarget('product_domain')
    expect(controller.state.suppression_draft.confirmed).toBeFalse()
    expect(controller.state.suppression_draft.confirmed_revision).toBeNull()
    controller.setSuppressionConfirmed(true)
    controller.setSuppressionReason('Changed reason')
    expect(controller.state.suppression_draft.confirmed).toBeFalse()
    controller.setSuppressionConfirmed(true)
    controller.setSuppressionSource('opt_out')
    expect(controller.state.suppression_draft.confirmed).toBeFalse()

    controller.setSuppressionReason(astral(500))
    controller.setSuppressionConfirmed(true)
    expect(controller.state.suppression_draft.confirmed).toBeTrue()
    controller.setSuppressionReason(astral(501))
    expect(controller.state.suppression_draft.confirmed).toBeFalse()
    expect(() => controller.setSuppressionConfirmed(true)).toThrow()
    expect(controller.state.suppression_draft.confirmed_revision).toBeNull()

    controller.setSuppressionReason('Valid again')
    controller.setSuppressionConfirmed(true)
    controller.setSuppressionConfirmed(false)
    expect(controller.state.suppression_draft.confirmed).toBeFalse()
    expect(controller.state.suppression_draft.confirmed_revision).toBeNull()
  })

  test('reject suppression confirmation without loaded current state or behind freshness guards', async () => {
    controller.setSuppressionTarget('email')
    controller.setSuppressionReason('No loaded candidate')
    expect(() => controller.setSuppressionConfirmed(true)).toThrow()
    expect(apiCalls).toEqual([])

    resetHarness()
    await controller.load()
    controller.setSuppressionTarget('email')
    controller.setSuppressionReason('Will become stale')
    controller.setProspectField('company_name', 'Stale edit')
    prospectQueue.push(async () => { throw safeError('stale_revision') })
    await expect(controller.saveProspect()).rejects.toMatchObject({ kind: 'stale_revision' })
    const beforeStaleConfirmation = apiCalls.length
    expect(() => controller.setSuppressionConfirmed(true)).toThrow()
    expect(apiCalls).toHaveLength(beforeStaleConfirmation)

    resetHarness()
    await controller.load()
    controller.setSuppressionTarget('email')
    controller.setSuppressionReason('Uncertain freshness')
    controller.setDraftField('subject_line', 'Uncertain draft')
    draftQueue.push(async () => { throw safeError('network') })
    await expect(controller.saveDraft()).rejects.toMatchObject({ kind: 'network' })
    const beforeRefreshRequiredConfirmation = apiCalls.length
    expect(() => controller.setSuppressionConfirmed(true)).toThrow()
    expect(apiCalls).toHaveLength(beforeRefreshRequiredConfirmation)
  })

  test('bind suppression to current revision and snapshot only the target enum', async () => {
    await controller.load()
    controller.setSuppressionTarget('effective_domain')
    controller.setSuppressionReason('  Requested suppression  ')
    controller.setSuppressionSource('opt_out')
    controller.setSuppressionConfirmed(true)
    expect(controller.state.suppression_draft.confirmed_revision).toBe(7)

    const pending = deferred<Suppression>()
    suppressionQueue.push(() => pending.promise)
    getQueue.push(async () => candidate({ revision: 8, effective_status: 'suppressed' }))
    const action = controller.suppress()
    expect(() => controller.setSuppressionTarget('email')).toThrow()
    expect(() => controller.setSuppressionReason('late mutation')).toThrow()
    expect(() => controller.setSuppressionSource('manual')).toThrow()
    expect(() => controller.setSuppressionConfirmed(false)).toThrow()
    pending.resolve({
      kind: 'domain',
      value: 'acme.test',
      reason: 'Requested suppression',
      source: 'opt_out',
      created_by: null,
      created_at: '2026-08-26T12:00:00.000Z',
      updated_at: '2026-08-26T12:00:00.000Z',
    })
    await action

    const call = apiCalls.find(entry => entry.name === 'createSuppression')
    expect(call?.payload).toEqual({
      prospect_public_id: ULID,
      expected_revision: 7,
      target: 'effective_domain',
      reason: 'Requested suppression',
      source: 'opt_out',
      confirm: true,
    })
    expect(JSON.stringify(call?.payload)).not.toContain('ada@acme.test')
    expect(JSON.stringify(call?.payload)).not.toContain('acme.test')
    expect(controller.state.suppression_draft).toEqual({
      target: null,
      reason: '',
      source: 'manual',
      confirmed: false,
      confirmed_revision: null,
    })
    expect(controller.state.suppression_dirty).toBeFalse()
    expect(controller.state.candidate?.effective_status).toBe('suppressed')
  })

  test('reject malformed suppression literals before follow-up GET and retain no response extras', async () => {
    await controller.load()
    controller.setSuppressionTarget('email')
    controller.setSuppressionReason('Suppress invalid response')
    controller.setSuppressionConfirmed(true)
    suppressionQueue.push(async () => ({
      kind: 'address',
      value: 'ada@acme.test',
      reason: 'Suppress invalid response',
      source: 'manual',
      created_by: null,
      created_at: '2026-08-26T12:00:00.000Z',
      updated_at: '2026-08-26T12:00:00.000Z',
      forbidden_suppression: 'RAW_SUPPRESSION_PII',
    }))

    await expect(controller.suppress()).rejects.toMatchObject({ kind: 'server' })
    expect(apiCalls.map(call => call.name)).toEqual(['getCandidate', 'createSuppression'])
    expect(controller.state.refresh_required).toBeTrue()
    expect(JSON.stringify(controller.state)).not.toContain('RAW_SUPPRESSION_PII')
  })

  test('return an export Blob even when the one audit GET fails and latch refresh', async () => {
    serverCandidate = approved()
    await controller.load()
    const blob = new Blob(['PII_BLOB_SENTINEL'], { type: 'text/csv;charset=UTF-8' })
    exportQueue.push(async () => ({ blob, filename: 'launchlog-outreach-founders-2026.csv' }))
    getQueue.push(async () => { throw safeError('network') })

    const result = await controller.exportCandidate()
    expect(result.blob).toBe(blob)
    expect(await result.blob.text()).toBe('PII_BLOB_SENTINEL')
    expect(apiCalls.find(call => call.name === 'exportCandidates')?.payload).toEqual({
      campaign_key: 'founders-2026',
      prospect_public_ids: [ULID],
      confirm_reexport: false,
    })
    expect(controller.state.refresh_required).toBeTrue()
    expect(controller.state.action_error?.kind).toBe('network')
    expect(apiCalls.slice(-2).map(call => call.name)).toEqual(['exportCandidates', 'getCandidate'])
    expect(controller.state.reexport_confirmed).toBeFalse()
  })

  test('require re-export confirmation and send the exact true payload', async () => {
    serverCandidate = approved({
      persisted_status: 'exported',
      effective_status: 'exported',
      audit: {
        approved_at: '2026-08-26T10:00:00.000Z',
        approved_by: { name: 'Admin', email: null },
        exported_at: '2026-08-26T11:00:00.000Z',
        exported_by: { name: 'Admin', email: null },
        export_count: 1,
        last_export_hash: 'a'.repeat(64),
      },
    })
    await controller.load()
    const before = apiCalls.length
    await expect(controller.exportCandidate()).rejects.toBeDefined()
    expect(apiCalls).toHaveLength(before)

    controller.setReexportConfirmed(true)
    exportQueue.push(async () => ({
      blob: new Blob(['email,subject\r\n']),
      filename: 'launchlog-outreach-founders-2026.csv',
    }))
    getQueue.push(async () => structuredClone(serverCandidate))
    await controller.exportCandidate()

    expect(apiCalls.find(call => call.name === 'exportCandidates')?.payload).toEqual({
      campaign_key: 'founders-2026',
      prospect_public_ids: [ULID],
      confirm_reexport: true,
    })
    expect(controller.state.reexport_confirmed).toBeFalse()
  })

  test('serialize actions and reject a duplicate without another API call', async () => {
    await controller.load()
    controller.setDraftField('subject_line', 'Pending subject')
    const pending = deferred<Candidate | Recovery>()
    draftQueue.push(() => pending.promise)
    const first = controller.saveDraft()
    const count = apiCalls.length
    await expect(controller.saveDraft()).rejects.toBeDefined()
    expect(apiCalls).toHaveLength(count)
    pending.resolve(candidate({ revision: 8 }))
    await first
  })
})

describe('disposal and privacy cleanup', () => {
  test('abort live requests, clear timers, and ignore every late callback', async () => {
    serverCandidate = generating()
    await controller.load()
    const pending = deferred<Candidate>()
    getQueue.push(() => pending.promise)
    await fireNextTimer()
    const signal = apiCalls.at(-1)?.transport?.signal
    const snapshot = structuredClone(controller.state.candidate)

    controller.dispose()
    expect(signal?.aborted).toBeTrue()
    expect(activeTimers()).toHaveLength(0)
    const disposedState = structuredClone(controller.state)
    const callsAfterFirstDispose = apiCalls.length
    controller.dispose()
    expect(controller.state).toEqual(disposedState)
    expect(apiCalls).toHaveLength(callsAfterFirstDispose)
    expect(activeTimers()).toHaveLength(0)
    pending.resolve(generating({ revision: 99 }))
    await flushMicrotasks()
    expect(controller.state.candidate).toBeNull()
    expect(controller.state.load).toBe('idle')
    expect(controller.state.candidate).not.toEqual(snapshot)
    expect(activeTimers()).toHaveLength(0)
  })

  test('wipe contact, source, draft, suppression, error, confirmation, and Blob sentinels', async () => {
    const piiCandidate = approved({
      prospect: {
        ...candidate().prospect,
        company_name: 'PII_COMPANY_SENTINEL',
        business_email: 'pii-email-sentinel@example.test',
        source_url: 'https://PII_SOURCE_SENTINEL.test',
        source_context: 'PII_SOURCE_CONTEXT_SENTINEL',
        notes: 'PII_NOTES_SENTINEL',
      },
      draft: {
        subject_line: 'PII_SUBJECT_SENTINEL',
        opening_line: 'PII_OPENING_SENTINEL',
        email_body: 'PII_BODY_SENTINEL',
      },
    })
    serverCandidate = piiCandidate
    await controller.load()
    controller.setSuppressionTarget('email')
    controller.setSuppressionReason('PII_SUPPRESSION_REASON_SENTINEL')
    controller.setSuppressionConfirmed(true)
    controller.setApprovalEnglishPlainText(true)
    controller.setApprovalPublicSource(true)
    controller.setReexportConfirmed(true)
    exportQueue.push(async () => ({
      blob: new Blob(['PII_BLOB_SENTINEL']),
      filename: 'launchlog-outreach-founders-2026.csv',
    }))
    const pendingAudit = deferred<Candidate>()
    getQueue.push(() => pendingAudit.promise)
    const download = controller.exportCandidate()
    await flushMicrotasks()

    controller.dispose()
    await expect(download).rejects.toMatchObject({ kind: 'aborted' })
    pendingAudit.resolve(piiCandidate)
    await flushMicrotasks()

    const serialized = JSON.stringify(controller.state)
    for (const sentinel of [
      'PII_COMPANY_SENTINEL',
      'pii-email-sentinel',
      'PII_SOURCE_SENTINEL',
      'PII_SOURCE_CONTEXT_SENTINEL',
      'PII_NOTES_SENTINEL',
      'PII_SUBJECT_SENTINEL',
      'PII_OPENING_SENTINEL',
      'PII_BODY_SENTINEL',
      'PII_SUPPRESSION_REASON_SENTINEL',
      'PII_BLOB_SENTINEL',
    ]) {
      expect(serialized).not.toContain(sentinel)
    }
    expect(controller.state.candidate).toBeNull()
    expect(controller.state.refresh_required).toBeFalse()
    expect(controller.state.approval_english_plain_text).toBeFalse()
    expect(controller.state.approval_public_source).toBeFalse()
    expect(controller.state.reexport_confirmed).toBeFalse()
    expect(controller.state.campaign_activation_confirmed).toBeFalse()
    expect(controller.state.action).toEqual({ name: null, phase: 'idle' })
    expect(controller.state.load_error).toBeNull()
    expect(controller.state.poll_error).toBeNull()
    expect(controller.state.action_error).toBeNull()
  })
})
