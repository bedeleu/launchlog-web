import { beforeEach, describe, expect, test } from 'bun:test'

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

interface Campaign {
  name: string
  key: string
  status: CampaignStatus
  sender_identity_label: string
  candidate_count: number
  created_at: string
  updated_at: string
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
  updateProspect: (publicId: string, payload: Record<string, unknown>, transport?: Transport) => Promise<Candidate | Recovery>
  updateDraft: (publicId: string, payload: Record<string, unknown>, transport?: Transport) => Promise<Candidate | Recovery>
  approveCandidate: (publicId: string, payload: Record<string, unknown>, transport?: Transport) => Promise<Candidate | Recovery>
  recaptureCandidate: (publicId: string, transport?: Transport) => Promise<Candidate | Recovery>
  renewCandidate: (publicId: string, transport?: Transport) => Promise<Candidate | Recovery>
  updateCampaign: (key: string, payload: Record<string, unknown>, transport?: Transport) => Promise<Campaign>
  createSuppression: (payload: Record<string, unknown>, transport?: Transport) => Promise<Suppression>
  exportCandidates: (payload: Record<string, unknown>, transport?: Transport) => Promise<{ blob: Blob, filename: string }>
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
  }) => Controller
  useOutreachCandidatePage: (publicId: string) => unknown
}

interface ApiCall {
  name: keyof Api
  publicId?: string
  key?: string
  payload?: Record<string, unknown>
  transport?: Transport
}

type CandidateThunk = () => Promise<Candidate>
type MutationThunk = () => Promise<Candidate | Recovery>
type CampaignThunk = () => Promise<Campaign>
type SuppressionThunk = () => Promise<Suppression>
type ExportThunk = () => Promise<{ blob: Blob, filename: string }>

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

const modulePath = ['./useOutreachCandidatePage', 'ts'].join('.')
const subject = await import(modulePath) as CandidatePageModule

const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const NOW_START = Date.parse('2026-08-26T12:00:00.000Z')
const TEN_MINUTES = 10 * 60 * 1000

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

function createController(): Controller {
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
    createAbortController: () => new AbortController(),
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

beforeEach(() => {
  nowMs = NOW_START
  timers = []
  nextTimerId = 0
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
  serverCandidate = candidate()
  api = createApi()
  controller = createController()
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
})

describe('dirty forms, confirmation binding, and full refresh', () => {
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

  test('gate repeated load and refresh behind one confirm-or-cancel discard flow', async () => {
    await controller.load()
    controller.setProspectField('company_name', 'Dirty company')
    controller.setSuppressionReason('Dirty suppression reason')
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
    expect(controller.state.discard_confirmation_required).toBeFalse()
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

    expect(apiCalls.at(-1)).toMatchObject({
      name: 'updateProspect',
      publicId: ULID,
      payload: {
        expected_revision: 7,
        source_attested: true,
        company_name: 'Acme Updated',
      },
    })
    expect(controller.state.candidate?.revision).toBe(11)
    expect(controller.state.prospect_edit).toBe('clean')
    expect(controller.state.prospect_form.company_name).toBe('Acme Updated')
    expect(controller.state.draft_edit).toBe('stale')
    expect(controller.state.draft_form.email_body).toBe('DIRTY_OTHER_DRAFT')
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

  test('latch uncertain PATCH/POST outcomes and allow only explicit successful GET to clear it', async () => {
    const uncertainMethods: Array<{
      prepare: () => void
      invoke: () => Promise<unknown>
      queue: MutationThunk[] | CampaignThunk[] | SuppressionThunk[] | ExportThunk[]
    }> = [
      {
        prepare: () => controller.setProspectField('company_name', 'Changed'),
        invoke: () => controller.saveProspect(),
        queue: prospectQueue,
      },
      {
        prepare: () => {
          controller.setApprovalEnglishPlainText(true)
          controller.setApprovalPublicSource(true)
        },
        invoke: () => controller.approve(),
        queue: approveQueue,
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
      await controller.refresh()
      expect(controller.state.refresh_required).toBeFalse()
      expect(controller.state.candidate?.revision).toBe(10)
    }
  })
})

describe('approval, lifecycle, suppression, and export actions', () => {
  test('approve only with both literals and the current returned revision', async () => {
    await controller.load()
    const callsBefore = apiCalls.length
    await expect(controller.approve()).rejects.toBeDefined()
    expect(apiCalls).toHaveLength(callsBefore)

    controller.setApprovalEnglishPlainText(true)
    controller.setApprovalPublicSource(true)
    approveQueue.push(async () => approved({ revision: 8 }))
    await controller.approve()
    expect(apiCalls.at(-1)).toMatchObject({
      name: 'approveCandidate',
      payload: {
        expected_revision: 7,
        confirm_english_plain_text: true,
        confirm_public_source: true,
      },
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

    expect(apiCalls.at(-1)).toMatchObject({
      name: 'updateCampaign',
      key: 'founders-2026',
      payload: { status: 'active' },
    })
    expect(controller.state.candidate?.campaign).toEqual({
      name: 'Founders active',
      key: 'founders-2026',
      status: 'active',
      sender_identity_label: 'Warmed founder domain B',
    })
    expect(controller.state.candidate?.revision).toBe(7)
    expect(controller.state.campaign_activation_confirmed).toBeFalse()
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
    expect(() => controller.setSuppressionReason('late mutation')).toThrow()
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
    expect(controller.state.candidate?.effective_status).toBe('suppressed')
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
    expect(controller.state.refresh_required).toBeTrue()
    expect(controller.state.action_error?.kind).toBe('network')
    expect(apiCalls.slice(-2).map(call => call.name)).toEqual(['exportCandidates', 'getCandidate'])
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
    pending.resolve(generating({ revision: 99 }))
    await flushMicrotasks()
    expect(controller.state.candidate).toBeNull()
    expect(controller.state.load).toBe('idle')
    expect(controller.state.candidate).not.toEqual(snapshot)
    expect(activeTimers()).toHaveLength(0)
  })

  test('wipe contact, source, draft, suppression, error, confirmation, and Blob sentinels', async () => {
    const piiCandidate = candidate({
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
