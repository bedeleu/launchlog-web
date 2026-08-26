import type {
  AdminOutreachClient,
  OutreachApiErrorKind,
  OutreachCampaign,
  OutreachCandidateDetail,
  OutreachCommittedRecovery,
  OutreachExportResult,
  OutreachSuppression,
  OutreachSuppressionSource,
  OutreachSuppressionTarget,
  OutreachTransportOptions,
} from './useAdminOutreach'
import {
  OutreachApiError,
  mapOutreachApiError,
  useAdminOutreach,
  validateCommittedRecovery,
} from './useAdminOutreach'
import { outreachSuppressionReasonSchema } from '../utils/outreach-form-schema'
import type {
  OutreachActionName,
  OutreachActionState,
  OutreachEditState,
  OutreachLoadState,
  OutreachViewState,
} from '../utils/outreach-view-state'
import { outreachViewState } from '../utils/outreach-view-state'

const POLL_DELAY_MS = 1_800
const GENERATION_WINDOW_MS = 10 * 60 * 1000
const MAX_INTEGER = 2_147_483_647
const SAFE_ERROR_KINDS = new Set<OutreachApiErrorKind>([
  'unauthenticated',
  'forbidden',
  'not_found',
  'stale_revision',
  'conflict',
  'validation',
  'rate_limited',
  'server',
  'aborted',
  'network',
])

export interface OutreachProspectForm {
  company_name: string
  product_name: string
  founder_first_name: string | null
  business_email: string
  country_code: string | null
  source_url: string
  source_context: string
  notes: string | null
}

export interface OutreachDraftForm {
  subject_line: string
  opening_line: string
  email_body: string
}

export interface OutreachSuppressionDraft {
  target: OutreachSuppressionTarget | null
  reason: string
  source: OutreachSuppressionSource
  confirmed: boolean
  confirmed_revision: number | null
}

export interface OutreachCandidatePageState {
  candidate: OutreachCandidateDetail | null
  load: OutreachLoadState
  prospect_form: OutreachProspectForm
  draft_form: OutreachDraftForm
  prospect_edit: OutreachEditState
  draft_edit: OutreachEditState
  suppression_draft: OutreachSuppressionDraft
  readonly suppression_dirty: boolean
  approval_english_plain_text: boolean
  approval_public_source: boolean
  campaign_activation_confirmed: boolean
  reexport_confirmed: boolean
  discard_confirmation_required: boolean
  refresh_required: boolean
  poll_active: boolean
  poll_deadline_reached: boolean
  load_error: OutreachApiError | null
  poll_error: OutreachApiError | null
  action_error: OutreachApiError | null
  validation_errors: Record<string, string[]>
  action: OutreachActionState
  readonly view: OutreachViewState
}

export interface OutreachCandidatePageController {
  state: OutreachCandidatePageState
  load: () => Promise<void>
  refresh: () => Promise<void>
  confirmDiscardAndRefresh: () => Promise<void>
  cancelDiscardRefresh: () => void
  setProspectField: (field: keyof OutreachProspectForm, value: string | null) => void
  setDraftField: (field: keyof OutreachDraftForm, value: string) => void
  saveProspect: () => Promise<void>
  saveDraft: () => Promise<void>
  setApprovalEnglishPlainText: (confirmed: boolean) => void
  setApprovalPublicSource: (confirmed: boolean) => void
  approve: () => Promise<void>
  setCampaignActivationConfirmed: (confirmed: boolean) => void
  activateCampaign: () => Promise<void>
  recapture: () => Promise<void>
  renew: () => Promise<void>
  setSuppressionTarget: (target: OutreachSuppressionTarget | null) => void
  setSuppressionReason: (reason: string) => void
  setSuppressionSource: (source: OutreachSuppressionSource) => void
  setSuppressionConfirmed: (confirmed: boolean) => void
  suppress: () => Promise<void>
  setReexportConfirmed: (confirmed: boolean) => void
  exportCandidate: () => Promise<OutreachExportResult>
  dispose: () => void
}

export interface OutreachCandidatePageApi {
  getCandidate: AdminOutreachClient['getCandidate']
  updateProspect: AdminOutreachClient['updateProspect']
  updateDraft: AdminOutreachClient['updateDraft']
  approveCandidate: AdminOutreachClient['approveCandidate']
  recaptureCandidate: AdminOutreachClient['recaptureCandidate']
  renewCandidate: AdminOutreachClient['renewCandidate']
  updateCampaign: AdminOutreachClient['updateCampaign']
  createSuppression: AdminOutreachClient['createSuppression']
  exportCandidates: AdminOutreachClient['exportCandidates']
}

export interface OutreachCandidatePageDependencies {
  api: OutreachCandidatePageApi
  now: () => number
  setTimeout: (callback: () => void, delay: number) => number
  clearTimeout: (handle: number) => void
  createAbortController: () => AbortController
}

interface AdoptOptions {
  explicit?: boolean
  submitted?: 'prospect' | 'draft'
}

function emptyProspectForm(): OutreachProspectForm {
  return {
    company_name: '',
    product_name: '',
    founder_first_name: null,
    business_email: '',
    country_code: null,
    source_url: '',
    source_context: '',
    notes: null,
  }
}

function emptyDraftForm(): OutreachDraftForm {
  return { subject_line: '', opening_line: '', email_body: '' }
}

function emptySuppressionDraft(): OutreachSuppressionDraft {
  return {
    target: null,
    reason: '',
    source: 'manual',
    confirmed: false,
    confirmed_revision: null,
  }
}

function prospectForm(candidate: OutreachCandidateDetail): OutreachProspectForm {
  return {
    company_name: candidate.prospect.company_name,
    product_name: candidate.prospect.product_name,
    founder_first_name: candidate.prospect.founder_first_name,
    business_email: candidate.prospect.business_email,
    country_code: candidate.prospect.country_code,
    source_url: candidate.prospect.source_url,
    source_context: candidate.prospect.source_context,
    notes: candidate.prospect.notes,
  }
}

function draftForm(candidate: OutreachCandidateDetail): OutreachDraftForm {
  return candidate.draft === null
    ? emptyDraftForm()
    : {
        subject_line: candidate.draft.subject_line,
        opening_line: candidate.draft.opening_line,
        email_body: candidate.draft.email_body,
      }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringRecord(value: unknown, keys: string[]): value is Record<string, unknown> {
  return isRecord(value) && keys.every(key => typeof value[key] === 'string')
}

function isCandidate(value: unknown, publicId: string): value is OutreachCandidateDetail {
  if (!isRecord(value) || value.public_id !== publicId) return false
  if (typeof value.revision !== 'number' || !Number.isInteger(value.revision) || value.revision < 0 || value.revision > MAX_INTEGER) return false
  if (!isStringRecord(value.campaign, ['name', 'key', 'status', 'sender_identity_label'])) return false
  if (!isStringRecord(value.prospect, [
    'company_name',
    'product_name',
    'product_url',
    'normalized_domain',
    'business_email',
    'source_url',
    'source_context',
    'source_attested_at',
  ])) return false
  if (typeof value.persisted_status !== 'string' || typeof value.effective_status !== 'string') return false
  if (!isRecord(value.audit) || typeof value.audit.export_count !== 'number') return false
  if (!Array.isArray(value.suppressions) || (!Array.isArray(value.validation_errors) && !isRecord(value.validation_errors))) return false
  if (value.draft !== null && !isStringRecord(value.draft, ['subject_line', 'opening_line', 'email_body'])) return false
  if (value.preview !== null) {
    if (!isRecord(value.preview) || typeof value.preview.status !== 'string' || typeof value.preview.preview_url !== 'string') return false
    if (!isRecord(value.preview.capabilities)) return false
  }
  return typeof value.created_at === 'string' && typeof value.updated_at === 'string'
}

function isCampaign(value: unknown): value is OutreachCampaign {
  return isStringRecord(value, [
    'name',
    'key',
    'status',
    'sender_identity_label',
    'created_at',
    'updated_at',
  ]) && typeof value.candidate_count === 'number'
}

function isSuppression(value: unknown): value is OutreachSuppression {
  return isStringRecord(value, ['kind', 'value', 'reason', 'source', 'created_at', 'updated_at'])
    && (value.created_by === null || isRecord(value.created_by))
}

function isDownload(value: unknown): value is OutreachExportResult {
  return isRecord(value) && value.blob instanceof Blob && typeof value.filename === 'string'
}

function normalizeError(error: unknown): OutreachApiError {
  if (error instanceof OutreachApiError) return error
  if (isRecord(error) && typeof error.kind === 'string' && SAFE_ERROR_KINDS.has(error.kind as OutreachApiErrorKind)) {
    const status = typeof error.status === 'number' ? error.status : null
    const fieldErrors: Record<string, string[]> = {}
    if (isRecord(error.fieldErrors)) {
      for (const [field, messages] of Object.entries(error.fieldErrors)) {
        if (Array.isArray(messages) && messages.every(message => typeof message === 'string')) {
          fieldErrors[field] = [...messages]
        }
      }
    }
    return new OutreachApiError(error.kind as OutreachApiErrorKind, status, fieldErrors)
  }
  return mapOutreachApiError(error)
}

function localConflict(): OutreachApiError {
  return new OutreachApiError('conflict')
}

function abortedError(): OutreachApiError {
  return new OutreachApiError('aborted')
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortedError())
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortedError())
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

export function createOutreachCandidatePageController(
  publicId: string,
  deps: OutreachCandidatePageDependencies,
): OutreachCandidatePageController {
  let disposed = false
  let epoch = 0
  let timerHandle: number | null = null
  let generationDeadline: number | null = null
  let prospectBaseRevision: number | null = null
  let draftBaseRevision: number | null = null
  let prospectUnsaved = false
  let draftUnsaved = false
  const activeRequests = new Set<AbortController>()

  const state: OutreachCandidatePageState = {
    candidate: null,
    load: 'idle',
    prospect_form: emptyProspectForm(),
    draft_form: emptyDraftForm(),
    prospect_edit: 'clean',
    draft_edit: 'clean',
    suppression_draft: emptySuppressionDraft(),
    get suppression_dirty() {
      return this.suppression_draft.target !== null
        || this.suppression_draft.reason !== ''
        || this.suppression_draft.source !== 'manual'
        || this.suppression_draft.confirmed
        || this.suppression_draft.confirmed_revision !== null
    },
    approval_english_plain_text: false,
    approval_public_source: false,
    campaign_activation_confirmed: false,
    reexport_confirmed: false,
    discard_confirmation_required: false,
    refresh_required: false,
    poll_active: false,
    poll_deadline_reached: false,
    load_error: null,
    poll_error: null,
    action_error: null,
    validation_errors: {},
    action: { name: null, phase: 'idle' },
    get view() {
      return outreachViewState({
        candidate: this.candidate,
        load: this.load,
        action: this.action,
        refresh_required: this.refresh_required,
        edits: { prospect: this.prospect_edit, draft: this.draft_edit },
        confirmations: {
          approval_english_plain_text: this.approval_english_plain_text,
          approval_public_source: this.approval_public_source,
          reexport: this.reexport_confirmed,
        },
        suppression: {
          target: this.suppression_draft.target,
          reason_valid: outreachSuppressionReasonSchema.safeParse(this.suppression_draft.reason).success,
          source: this.suppression_draft.source,
          confirmed: this.candidate !== null
            && this.suppression_draft.confirmed
            && this.suppression_draft.confirmed_revision === this.candidate.revision,
        },
        nowMs: deps.now(),
      })
    },
  }

  function clearTimer(): void {
    if (timerHandle !== null) deps.clearTimeout(timerHandle)
    timerHandle = null
  }

  function invalidateAsyncWork(): number {
    epoch += 1
    clearTimer()
    state.poll_active = false
    for (const request of activeRequests) request.abort()
    return epoch
  }

  async function request<T>(invoke: (transport: OutreachTransportOptions) => Promise<T>): Promise<T> {
    const abortController = deps.createAbortController()
    activeRequests.add(abortController)
    try {
      return await abortable(invoke({ signal: abortController.signal }), abortController.signal)
    }
    finally {
      activeRequests.delete(abortController)
    }
  }

  function resetConfirmations(): void {
    state.approval_english_plain_text = false
    state.approval_public_source = false
    state.campaign_activation_confirmed = false
    state.reexport_confirmed = false
  }

  function clearSuppressionConfirmation(): void {
    state.suppression_draft.confirmed = false
    state.suppression_draft.confirmed_revision = null
  }

  function resetRevisionConfirmations(): void {
    state.approval_english_plain_text = false
    state.approval_public_source = false
    state.reexport_confirmed = false
    clearSuppressionConfirmation()
  }

  function adoptCandidate(candidate: OutreachCandidateDetail, options: AdoptOptions = {}): void {
    const previousRevision = state.candidate?.revision ?? null
    const revisionChanged = previousRevision !== null && previousRevision !== candidate.revision
    state.candidate = candidate
    state.load = 'ready'
    state.load_error = null
    state.poll_error = null
    state.validation_errors = {}

    if (options.explicit) {
      state.prospect_form = prospectForm(candidate)
      state.draft_form = draftForm(candidate)
      state.prospect_edit = 'clean'
      state.draft_edit = 'clean'
      prospectBaseRevision = candidate.revision
      draftBaseRevision = candidate.revision
      prospectUnsaved = false
      draftUnsaved = false
      state.suppression_draft = emptySuppressionDraft()
      resetConfirmations()
      state.discard_confirmation_required = false
      state.refresh_required = false
      return
    }

    if (revisionChanged) resetRevisionConfirmations()

    if (options.submitted === 'prospect' || state.prospect_edit === 'clean') {
      state.prospect_form = prospectForm(candidate)
      state.prospect_edit = 'clean'
      prospectBaseRevision = candidate.revision
      prospectUnsaved = false
    }
    else if (state.prospect_edit === 'dirty' && prospectBaseRevision !== candidate.revision) {
      state.prospect_edit = 'stale'
    }

    if (options.submitted === 'draft' || state.draft_edit === 'clean') {
      state.draft_form = draftForm(candidate)
      state.draft_edit = 'clean'
      draftBaseRevision = candidate.revision
      draftUnsaved = false
    }
    else if (state.draft_edit === 'dirty' && draftBaseRevision !== candidate.revision) {
      state.draft_edit = 'stale'
    }
  }

  function stopPolling(deadlineReached = false): void {
    clearTimer()
    state.poll_active = false
    if (deadlineReached) state.poll_deadline_reached = true
  }

  function schedulePoll(): void {
    clearTimer()
    if (disposed || state.refresh_required || state.candidate?.effective_status !== 'preview_generating') {
      state.poll_active = false
      return
    }
    if (generationDeadline === null) generationDeadline = deps.now() + GENERATION_WINDOW_MS
    if (deps.now() >= generationDeadline) {
      stopPolling(true)
      return
    }

    state.poll_active = true
    const scheduledEpoch = epoch
    timerHandle = deps.setTimeout(() => {
      timerHandle = null
      if (disposed || scheduledEpoch !== epoch || state.refresh_required || generationDeadline === null) return
      if (deps.now() >= generationDeadline) {
        stopPolling(true)
        return
      }
      void poll(scheduledEpoch)
    }, POLL_DELAY_MS)
  }

  async function poll(pollEpoch: number): Promise<void> {
    try {
      const result = await request(transport => deps.api.getCandidate(publicId, transport))
      if (disposed || pollEpoch !== epoch) return
      if (!isCandidate(result, publicId)) throw new OutreachApiError('server')
      adoptCandidate(result)
      if (result.effective_status === 'preview_generating') schedulePoll()
      else stopPolling()
    }
    catch (error) {
      if (disposed || pollEpoch !== epoch) return
      state.poll_error = normalizeError(error)
      schedulePoll()
    }
  }

  function updatePollingAfterAdoption(forceNewWindow = false): void {
    if (state.candidate?.effective_status !== 'preview_generating') {
      stopPolling()
      return
    }
    if (forceNewWindow || generationDeadline === null) {
      generationDeadline = deps.now() + GENERATION_WINDOW_MS
      state.poll_deadline_reached = false
    }
    schedulePoll()
  }

  function hasDiscardableState(): boolean {
    return prospectUnsaved || draftUnsaved || state.suppression_dirty
  }

  function ensureUsable(): void {
    if (disposed) throw abortedError()
  }

  function ensureNoPendingAction(): void {
    ensureUsable()
    if (state.action.phase === 'pending') throw localConflict()
  }

  function ensureCurrentCandidate(): OutreachCandidateDetail {
    ensureNoPendingAction()
    if (state.candidate === null || state.refresh_required || state.prospect_edit === 'stale' || state.draft_edit === 'stale') {
      throw localConflict()
    }
    return state.candidate
  }

  function beginAction(name: OutreachActionName): number {
    ensureNoPendingAction()
    const actionEpoch = invalidateAsyncWork()
    state.action = { name, phase: 'pending' }
    state.action_error = null
    state.validation_errors = {}
    return actionEpoch
  }

  function finishAction(name: OutreachActionName): void {
    state.action = { name, phase: 'success' }
    state.action_error = null
    state.validation_errors = {}
  }

  function latchRefresh(error: OutreachApiError): void {
    state.refresh_required = true
    state.action_error = error
    state.action = { name: state.action.name ?? 'refresh', phase: 'action_error' }
    stopPolling()
  }

  function resumeOriginalPoll(): void {
    if (disposed || state.refresh_required || state.candidate?.effective_status !== 'preview_generating') return
    schedulePoll()
  }

  async function explicitRefresh(isInitial: boolean): Promise<void> {
    ensureNoPendingAction()
    const refreshEpoch = invalidateAsyncWork()
    if (isInitial) {
      state.load = 'loading'
      state.load_error = null
    }
    else {
      state.action = { name: 'refresh', phase: 'pending' }
      state.action_error = null
    }

    try {
      const result = await request(transport => deps.api.getCandidate(publicId, transport))
      if (disposed || refreshEpoch !== epoch) throw abortedError()
      if (!isCandidate(result, publicId)) throw new OutreachApiError('server')
      adoptCandidate(result, { explicit: true })
      if (!isInitial) finishAction('refresh')
      updatePollingAfterAdoption(false)
    }
    catch (rawError) {
      const error = normalizeError(rawError)
      if (disposed || refreshEpoch !== epoch) throw abortedError()
      if (isInitial) {
        state.load = 'load_error'
        state.load_error = error
      }
      else {
        state.action_error = error
        state.action = { name: 'refresh', phase: error.kind === 'validation' ? 'validation_error' : 'action_error' }
        if (!state.refresh_required) resumeOriginalPoll()
      }
      throw error
    }
  }

  async function load(): Promise<void> {
    ensureNoPendingAction()
    if (state.candidate !== null && hasDiscardableState()) {
      state.discard_confirmation_required = true
      return
    }
    await explicitRefresh(state.candidate === null)
  }

  async function refresh(): Promise<void> {
    ensureNoPendingAction()
    if (state.candidate !== null && hasDiscardableState()) {
      state.discard_confirmation_required = true
      return
    }
    await explicitRefresh(state.candidate === null)
  }

  async function confirmDiscardAndRefresh(): Promise<void> {
    ensureNoPendingAction()
    if (!state.discard_confirmation_required) throw localConflict()
    state.discard_confirmation_required = false
    state.prospect_form = state.candidate === null ? emptyProspectForm() : prospectForm(state.candidate)
    state.draft_form = state.candidate === null ? emptyDraftForm() : draftForm(state.candidate)
    state.prospect_edit = 'clean'
    state.draft_edit = 'clean'
    prospectUnsaved = false
    draftUnsaved = false
    state.suppression_draft = emptySuppressionDraft()
    resetConfirmations()
    await explicitRefresh(state.candidate === null)
  }

  function cancelDiscardRefresh(): void {
    ensureUsable()
    state.discard_confirmation_required = false
  }

  function setProspectField(field: keyof OutreachProspectForm, value: string | null): void {
    ensureNoPendingAction()
    if (state.prospect_form[field] === value) return
    Object.assign(state.prospect_form, { [field]: value })
    state.prospect_edit = 'dirty'
    prospectUnsaved = true
    state.approval_english_plain_text = false
    state.approval_public_source = false
    state.reexport_confirmed = false
  }

  function setDraftField(field: keyof OutreachDraftForm, value: string): void {
    ensureNoPendingAction()
    if (state.draft_form[field] === value) return
    state.draft_form[field] = value
    state.draft_edit = 'dirty'
    draftUnsaved = true
    state.approval_english_plain_text = false
    state.approval_public_source = false
    state.reexport_confirmed = false
  }

  async function candidateMutation(
    name: 'save_prospect' | 'save_draft' | 'approve' | 'recapture' | 'renew',
    invoke: (transport: OutreachTransportOptions) => Promise<unknown>,
    options: { submitted?: 'prospect' | 'draft', freshGeneration?: boolean, resetApproval?: boolean } = {},
  ): Promise<void> {
    const previousProspectEdit = state.prospect_edit
    const previousDraftEdit = state.draft_edit
    const actionEpoch = beginAction(name)
    if (options.submitted === 'prospect') state.prospect_edit = 'saving'
    if (options.submitted === 'draft') state.draft_edit = 'saving'
    let committed = false

    try {
      const result = await request(invoke)
      if (disposed || actionEpoch !== epoch) throw abortedError()
      let candidate: OutreachCandidateDetail
      if (isRecord(result) && result.persistence_status === 'committed') {
        const recoveredId = validateCommittedRecovery(result as unknown as OutreachCommittedRecovery, publicId)
        committed = true
        candidate = await request(transport => deps.api.getCandidate(recoveredId, transport))
        if (disposed || actionEpoch !== epoch) throw abortedError()
      }
      else {
        candidate = result as OutreachCandidateDetail
      }
      if (!isCandidate(candidate, publicId)) throw new OutreachApiError('server')
      adoptCandidate(candidate, { submitted: options.submitted })
      if (options.resetApproval) {
        state.approval_english_plain_text = false
        state.approval_public_source = false
      }
      finishAction(name)
      updatePollingAfterAdoption(options.freshGeneration === true)
    }
    catch (rawError) {
      const error = normalizeError(rawError)
      if (disposed || actionEpoch !== epoch) throw abortedError()
      if (options.submitted === 'prospect') state.prospect_edit = previousProspectEdit
      if (options.submitted === 'draft') state.draft_edit = previousDraftEdit
      state.action_error = error
      state.validation_errors = error.kind === 'validation' ? { ...error.fieldErrors } : {}
      state.action = { name, phase: error.kind === 'validation' ? 'validation_error' : 'action_error' }

      if (committed) {
        state.prospect_edit = 'stale'
        state.draft_edit = 'stale'
        latchRefresh(error)
      }
      else if (error.kind === 'stale_revision') {
        state.prospect_edit = 'stale'
        state.draft_edit = 'stale'
        stopPolling()
      }
      else if (error.kind === 'network' || error.kind === 'server' || error.kind === 'aborted') {
        latchRefresh(error)
      }
      else {
        if (error.kind === 'validation' && options.submitted === 'prospect') state.prospect_edit = 'save_error'
        if (error.kind === 'validation' && options.submitted === 'draft') state.draft_edit = 'save_error'
        resumeOriginalPoll()
      }
      throw error
    }
  }

  async function saveProspect(): Promise<void> {
    const candidate = ensureCurrentCandidate()
    if (
      candidate.campaign.status === 'archived'
      || candidate.effective_status === 'converted'
      || (state.prospect_edit !== 'dirty' && state.prospect_edit !== 'save_error')
    ) {
      throw localConflict()
    }
    const payload = {
      expected_revision: candidate.revision,
      source_attested: true as const,
      ...state.prospect_form,
    }
    await candidateMutation(
      'save_prospect',
      transport => deps.api.updateProspect(publicId, payload, transport),
      { submitted: 'prospect' },
    )
  }

  async function saveDraft(): Promise<void> {
    const candidate = ensureCurrentCandidate()
    if (
      candidate.campaign.status === 'archived'
      || candidate.effective_status === 'converted'
      || (state.draft_edit !== 'dirty' && state.draft_edit !== 'save_error')
    ) {
      throw localConflict()
    }
    const payload = { expected_revision: candidate.revision, ...state.draft_form }
    await candidateMutation(
      'save_draft',
      transport => deps.api.updateDraft(publicId, payload, transport),
      { submitted: 'draft' },
    )
  }

  function setApprovalEnglishPlainText(confirmed: boolean): void {
    ensureNoPendingAction()
    state.approval_english_plain_text = confirmed
  }

  function setApprovalPublicSource(confirmed: boolean): void {
    ensureNoPendingAction()
    state.approval_public_source = confirmed
  }

  async function approve(): Promise<void> {
    const candidate = ensureCurrentCandidate()
    if (state.view.blockers.approve.length > 0) throw localConflict()
    const payload = {
      expected_revision: candidate.revision,
      confirm_english_plain_text: true as const,
      confirm_public_source: true as const,
    }
    await candidateMutation(
      'approve',
      transport => deps.api.approveCandidate(publicId, payload, transport),
      { resetApproval: true },
    )
  }

  function setCampaignActivationConfirmed(confirmed: boolean): void {
    ensureNoPendingAction()
    state.campaign_activation_confirmed = confirmed
  }

  async function activateCampaign(): Promise<void> {
    const candidate = ensureCurrentCandidate()
    if (candidate.campaign.status !== 'draft' || !state.campaign_activation_confirmed) throw localConflict()
    const actionEpoch = beginAction('activate_campaign')
    try {
      const campaign = await request(transport => deps.api.updateCampaign(candidate.campaign.key, { status: 'active' }, transport))
      if (disposed || actionEpoch !== epoch) throw abortedError()
      if (!isCampaign(campaign)) throw new OutreachApiError('server')
      if (state.candidate !== null) {
        state.candidate = {
          ...state.candidate,
          campaign: {
            name: campaign.name,
            key: campaign.key,
            status: campaign.status,
            sender_identity_label: campaign.sender_identity_label,
          },
        }
      }
      state.campaign_activation_confirmed = false
      finishAction('activate_campaign')
      resumeOriginalPoll()
    }
    catch (rawError) {
      const error = normalizeError(rawError)
      if (disposed || actionEpoch !== epoch) throw abortedError()
      state.action_error = error
      state.action = { name: 'activate_campaign', phase: error.kind === 'validation' ? 'validation_error' : 'action_error' }
      if (error.kind === 'network' || error.kind === 'server' || error.kind === 'aborted') latchRefresh(error)
      else if (error.kind === 'stale_revision') {
        state.prospect_edit = 'stale'
        state.draft_edit = 'stale'
      }
      else resumeOriginalPoll()
      throw error
    }
  }

  async function recapture(): Promise<void> {
    ensureCurrentCandidate()
    if (state.view.blockers.recapture.length > 0) throw localConflict()
    await candidateMutation(
      'recapture',
      transport => deps.api.recaptureCandidate(publicId, transport),
      { freshGeneration: true },
    )
  }

  async function renew(): Promise<void> {
    ensureCurrentCandidate()
    if (state.view.blockers.renew.length > 0) throw localConflict()
    await candidateMutation(
      'renew',
      transport => deps.api.renewCandidate(publicId, transport),
      { freshGeneration: true },
    )
  }

  function ensureSuppressionSetterAvailable(): void {
    ensureNoPendingAction()
  }

  function setSuppressionTarget(target: OutreachSuppressionTarget | null): void {
    ensureSuppressionSetterAvailable()
    if (state.suppression_draft.target === target) return
    state.suppression_draft.target = target
    clearSuppressionConfirmation()
  }

  function setSuppressionReason(reason: string): void {
    ensureSuppressionSetterAvailable()
    if (state.suppression_draft.reason === reason) return
    const oldSemantic = state.suppression_draft.reason.trim()
    state.suppression_draft.reason = reason
    if (oldSemantic !== reason.trim()) clearSuppressionConfirmation()
  }

  function setSuppressionSource(source: OutreachSuppressionSource): void {
    ensureSuppressionSetterAvailable()
    if (state.suppression_draft.source === source) return
    state.suppression_draft.source = source
    clearSuppressionConfirmation()
  }

  function setSuppressionConfirmed(confirmed: boolean): void {
    ensureSuppressionSetterAvailable()
    if (!confirmed) {
      clearSuppressionConfirmation()
      return
    }
    const candidate = state.candidate
    if (
      candidate === null
      || state.refresh_required
      || state.prospect_edit === 'stale'
      || state.draft_edit === 'stale'
      || state.suppression_draft.target === null
      || !outreachSuppressionReasonSchema.safeParse(state.suppression_draft.reason).success
    ) {
      throw localConflict()
    }
    state.suppression_draft.confirmed = true
    state.suppression_draft.confirmed_revision = candidate.revision
  }

  async function suppress(): Promise<void> {
    const candidate = ensureCurrentCandidate()
    if (state.view.blockers.suppress.length > 0) throw localConflict()
    const parsedReason = outreachSuppressionReasonSchema.safeParse(state.suppression_draft.reason)
    if (!parsedReason.success || state.suppression_draft.target === null) throw localConflict()
    const payload = {
      prospect_public_id: publicId,
      expected_revision: candidate.revision,
      target: state.suppression_draft.target,
      reason: parsedReason.data,
      source: state.suppression_draft.source,
      confirm: true as const,
    }
    const actionEpoch = beginAction('suppress')
    let committed = false
    try {
      const result = await request(transport => deps.api.createSuppression(payload, transport))
      if (disposed || actionEpoch !== epoch) throw abortedError()
      if (!isSuppression(result)) throw new OutreachApiError('server')
      committed = true
      state.suppression_draft = emptySuppressionDraft()
      const refreshed = await request(transport => deps.api.getCandidate(publicId, transport))
      if (disposed || actionEpoch !== epoch) throw abortedError()
      if (!isCandidate(refreshed, publicId)) throw new OutreachApiError('server')
      adoptCandidate(refreshed)
      finishAction('suppress')
      updatePollingAfterAdoption(false)
    }
    catch (rawError) {
      const error = normalizeError(rawError)
      if (disposed || actionEpoch !== epoch) throw abortedError()
      state.action_error = error
      state.action = { name: 'suppress', phase: error.kind === 'validation' ? 'validation_error' : 'action_error' }
      if (committed || error.kind === 'network' || error.kind === 'server' || error.kind === 'aborted') latchRefresh(error)
      else if (error.kind === 'stale_revision') {
        state.prospect_edit = 'stale'
        state.draft_edit = 'stale'
      }
      else resumeOriginalPoll()
      throw error
    }
  }

  function setReexportConfirmed(confirmed: boolean): void {
    ensureNoPendingAction()
    state.reexport_confirmed = confirmed
  }

  async function exportCandidate(): Promise<OutreachExportResult> {
    const candidate = ensureCurrentCandidate()
    if (state.view.blockers.export.length > 0) throw localConflict()
    const payload = {
      campaign_key: candidate.campaign.key,
      prospect_public_ids: [publicId],
      confirm_reexport: state.reexport_confirmed,
    }
    const actionEpoch = beginAction('export')
    const download = { value: null as OutreachExportResult | null }
    try {
      const result = await request(transport => deps.api.exportCandidates(payload, transport))
      if (disposed || actionEpoch !== epoch) throw abortedError()
      if (!isDownload(result)) throw new OutreachApiError('server')
      download.value = result
      state.reexport_confirmed = false
      try {
        const refreshed = await request(transport => deps.api.getCandidate(publicId, transport))
        if (disposed || actionEpoch !== epoch) throw abortedError()
        if (!isCandidate(refreshed, publicId)) throw new OutreachApiError('server')
        adoptCandidate(refreshed)
        finishAction('export')
        updatePollingAfterAdoption(false)
      }
      catch (rawRefreshError) {
        const refreshError = normalizeError(rawRefreshError)
        if (disposed || actionEpoch !== epoch) {
          download.value = null
          throw abortedError()
        }
        latchRefresh(refreshError)
      }
      if (download.value === null) throw abortedError()
      const completedDownload = download.value
      download.value = null
      return completedDownload
    }
    catch (rawError) {
      const error = normalizeError(rawError)
      if (disposed || actionEpoch !== epoch) {
        download.value = null
        throw abortedError()
      }
      if (download.value !== null && state.refresh_required) {
        const completedDownload = download.value
        download.value = null
        return completedDownload
      }
      state.action_error = error
      state.action = { name: 'export', phase: error.kind === 'validation' ? 'validation_error' : 'action_error' }
      if (error.kind === 'network' || error.kind === 'server' || error.kind === 'aborted') latchRefresh(error)
      else if (error.kind === 'stale_revision') {
        state.prospect_edit = 'stale'
        state.draft_edit = 'stale'
      }
      else resumeOriginalPoll()
      download.value = null
      throw error
    }
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    invalidateAsyncWork()
    generationDeadline = null
    prospectBaseRevision = null
    draftBaseRevision = null
    prospectUnsaved = false
    draftUnsaved = false
    state.candidate = null
    state.load = 'idle'
    state.prospect_form = emptyProspectForm()
    state.draft_form = emptyDraftForm()
    state.prospect_edit = 'clean'
    state.draft_edit = 'clean'
    state.suppression_draft = emptySuppressionDraft()
    resetConfirmations()
    state.discard_confirmation_required = false
    state.refresh_required = false
    state.poll_active = false
    state.poll_deadline_reached = false
    state.load_error = null
    state.poll_error = null
    state.action_error = null
    state.validation_errors = {}
    state.action = { name: null, phase: 'idle' }
  }

  return {
    state,
    load,
    refresh,
    confirmDiscardAndRefresh,
    cancelDiscardRefresh,
    setProspectField,
    setDraftField,
    saveProspect,
    saveDraft,
    setApprovalEnglishPlainText,
    setApprovalPublicSource,
    approve,
    setCampaignActivationConfirmed,
    activateCampaign,
    recapture,
    renew,
    setSuppressionTarget,
    setSuppressionReason,
    setSuppressionSource,
    setSuppressionConfirmed,
    suppress,
    setReexportConfirmed,
    exportCandidate,
    dispose,
  }
}

export function useOutreachCandidatePage(publicId: string): OutreachCandidatePageController {
  const api = useAdminOutreach()
  const controller = createOutreachCandidatePageController(publicId, {
    api,
    now: () => Date.now(),
    setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay) as unknown as number,
    clearTimeout: handle => globalThis.clearTimeout(handle),
    createAbortController: () => new AbortController(),
  })
  onScopeDispose(controller.dispose)
  return controller
}
