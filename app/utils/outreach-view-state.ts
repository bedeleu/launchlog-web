import type {
  OutreachActorSummary,
  OutreachCampaignStatus,
  OutreachCandidateDetail,
  OutreachEffectiveStatus,
  OutreachPersistedStatus,
  OutreachSuppressionSource,
  OutreachSuppressionTarget,
} from '../composables/useAdminOutreach'

const DAY = 24 * 60 * 60 * 1000

export type OutreachLoadState = 'idle' | 'loading' | 'ready' | 'load_error'
export type OutreachEditState = 'clean' | 'dirty' | 'saving' | 'stale' | 'save_error'
export type OutreachActionName =
  | 'refresh'
  | 'activate_campaign'
  | 'save_prospect'
  | 'save_draft'
  | 'approve'
  | 'recapture'
  | 'renew'
  | 'suppress'
  | 'export'

export type OutreachActionState =
  | { name: null, phase: 'idle' }
  | { name: OutreachActionName, phase: 'pending' | 'success' | 'validation_error' | 'action_error' }

export interface OutreachViewStateInput {
  candidate: OutreachCandidateDetail | null
  load: OutreachLoadState
  action: OutreachActionState
  refresh_required: boolean
  edits: { prospect: OutreachEditState, draft: OutreachEditState }
  confirmations: {
    approval_english_plain_text: boolean
    approval_public_source: boolean
    reexport: boolean
  }
  suppression: {
    target: OutreachSuppressionTarget | null
    reason_valid: boolean
    source: OutreachSuppressionSource
    confirmed: boolean
  }
  nowMs: number
}

export const OUTREACH_BLOCKER_ORDER = [
  'not_loaded',
  'action_pending',
  'refresh_required',
  'campaign_archived',
  'campaign_inactive',
  'stale_revision',
  'prospect_not_clean',
  'draft_not_clean',
  'suppressed',
  'converted',
  'preview_generating',
  'preview_failed',
  'preview_expired',
  'preview_not_ready',
  'ttl_under_24h',
  'invalid_draft',
  'approval_not_available',
  'not_approved',
  'approval_confirmation_required',
  'reexport_confirmation_required',
  'recapture_not_available',
  'renewal_not_available',
  'suppression_target_unavailable',
  'suppression_reason_invalid',
  'suppression_confirmation_required',
] as const

export type OutreachBlocker = typeof OUTREACH_BLOCKER_ORDER[number]

export interface OutreachAuditView {
  approved_at: string | null
  approved_by: OutreachActorSummary | null
  exported_at: string | null
  exported_by: OutreachActorSummary | null
  export_count: number
  last_export_hash: string | null
  requires_reexport_confirmation: boolean
}

export interface OutreachTimingView {
  expires_at: string | null
  expiry_valid: boolean
  remaining_ms: number | null
  expired: boolean
  has_review_window: boolean
  in_renewal_window: boolean
}

export interface OutreachViewState {
  load: OutreachLoadState
  effective: OutreachEffectiveStatus | null
  persisted: OutreachPersistedStatus | null
  campaign: OutreachCampaignStatus | null
  action: OutreachActionState
  refresh_required: boolean
  edits: { prospect: OutreachEditState, draft: OutreachEditState }
  blockers: {
    approve: OutreachBlocker[]
    export: OutreachBlocker[]
    recapture: OutreachBlocker[]
    renew: OutreachBlocker[]
    suppress: OutreachBlocker[]
  }
  audit: OutreachAuditView
  timing: OutreachTimingView
}

function timingFor(candidate: OutreachCandidateDetail | null, nowMs: number): OutreachTimingView {
  const expiresAt = candidate?.preview?.expires_at ?? null
  if (expiresAt === null) {
    return {
      expires_at: null,
      expiry_valid: false,
      remaining_ms: null,
      expired: false,
      has_review_window: false,
      in_renewal_window: false,
    }
  }

  const expiresAtMs = Date.parse(expiresAt)
  if (!Number.isFinite(expiresAtMs)) {
    return {
      expires_at: expiresAt,
      expiry_valid: false,
      remaining_ms: null,
      expired: false,
      has_review_window: false,
      in_renewal_window: false,
    }
  }

  const remainingMs = expiresAtMs - nowMs
  return {
    expires_at: expiresAt,
    expiry_valid: true,
    remaining_ms: remainingMs,
    expired: remainingMs <= 0,
    has_review_window: remainingMs >= DAY,
    in_renewal_window: remainingMs <= 2 * DAY,
  }
}

function auditFor(candidate: OutreachCandidateDetail | null): OutreachAuditView {
  if (candidate === null) {
    return {
      approved_at: null,
      approved_by: null,
      exported_at: null,
      exported_by: null,
      export_count: 0,
      last_export_hash: null,
      requires_reexport_confirmation: false,
    }
  }

  return {
    approved_at: candidate.audit.approved_at,
    approved_by: candidate.audit.approved_by,
    exported_at: candidate.audit.exported_at,
    exported_by: candidate.audit.exported_by,
    export_count: candidate.audit.export_count,
    last_export_hash: candidate.audit.last_export_hash,
    requires_reexport_confirmation: candidate.audit.export_count > 0,
  }
}

function ordered(blockers: Iterable<OutreachBlocker>): OutreachBlocker[] {
  const included = new Set(blockers)
  return OUTREACH_BLOCKER_ORDER.filter(blocker => included.has(blocker))
}

function commonBlockers(input: OutreachViewStateInput): OutreachBlocker[] {
  const blockers: OutreachBlocker[] = []
  if (input.candidate === null) blockers.push('not_loaded')
  if (input.action.phase === 'pending') blockers.push('action_pending')
  if (input.refresh_required) blockers.push('refresh_required')
  if (input.edits.prospect === 'stale' || input.edits.draft === 'stale') blockers.push('stale_revision')
  return blockers
}

function candidateStateBlockers(candidate: OutreachCandidateDetail): OutreachBlocker[] {
  const blockers: OutreachBlocker[] = []
  if (candidate.effective_status === 'suppressed') blockers.push('suppressed')
  if (candidate.effective_status === 'converted') blockers.push('converted')
  if (candidate.effective_status === 'preview_generating' || candidate.preview?.status === 'generating') {
    blockers.push('preview_generating')
  }
  if (candidate.effective_status === 'failed' || candidate.preview?.status === 'failed') blockers.push('preview_failed')
  if (candidate.effective_status === 'expired' || candidate.preview?.status === 'expired') blockers.push('preview_expired')
  return blockers
}

export function outreachViewState(input: OutreachViewStateInput): OutreachViewState {
  const candidate = input.candidate
  const timing = timingFor(candidate, input.nowMs)
  const audit = auditFor(candidate)
  const common = commonBlockers(input)
  const approve: OutreachBlocker[] = [...common]
  const exportBlockers: OutreachBlocker[] = [...common]
  const recapture: OutreachBlocker[] = [...common]
  const renew: OutreachBlocker[] = [...common]
  const suppress: OutreachBlocker[] = [...common]

  if (candidate !== null) {
    const stateBlockers = candidateStateBlockers(candidate)
    const archived = candidate.campaign.status === 'archived'
    const previewReady = candidate.preview?.status === 'ready' && timing.expiry_valid
    const draftInvalid = candidate.draft === null || Object.keys(candidate.validation_errors).length > 0

    if (archived) {
      approve.push('campaign_archived')
      exportBlockers.push('campaign_archived')
      recapture.push('campaign_archived')
      renew.push('campaign_archived')
    }
    if (candidate.campaign.status !== 'active') exportBlockers.push('campaign_inactive')

    if (input.edits.prospect !== 'clean') {
      approve.push('prospect_not_clean')
      exportBlockers.push('prospect_not_clean')
    }
    if (input.edits.draft !== 'clean') {
      approve.push('draft_not_clean')
      exportBlockers.push('draft_not_clean')
    }

    approve.push(...stateBlockers)
    exportBlockers.push(...stateBlockers)

    if (!previewReady) {
      if (!stateBlockers.some(blocker => blocker.startsWith('preview_'))) {
        approve.push('preview_not_ready')
        exportBlockers.push('preview_not_ready')
      }
    }
    else if (!timing.has_review_window) {
      if (timing.expired) {
        approve.push('preview_expired')
        exportBlockers.push('preview_expired')
      }
      else {
        approve.push('ttl_under_24h')
        exportBlockers.push('ttl_under_24h')
      }
    }

    if (draftInvalid) {
      approve.push('invalid_draft')
      exportBlockers.push('invalid_draft')
    }
    if (candidate.persisted_status !== 'ready_for_review') approve.push('approval_not_available')
    if (!input.confirmations.approval_english_plain_text || !input.confirmations.approval_public_source) {
      approve.push('approval_confirmation_required')
    }

    const exportApproved = (candidate.persisted_status === 'approved' || candidate.persisted_status === 'exported')
      && audit.approved_at !== null
    if (!exportApproved) exportBlockers.push('not_approved')
    if (audit.requires_reexport_confirmation && !input.confirmations.reexport) {
      exportBlockers.push('reexport_confirmation_required')
    }

    if (candidate.effective_status === 'suppressed') recapture.push('suppressed')
    if (candidate.effective_status === 'converted') recapture.push('converted')
    if (candidate.effective_status === 'preview_generating' || candidate.preview?.status === 'generating') {
      recapture.push('preview_generating')
    }
    if (candidate.effective_status === 'expired' || candidate.preview?.status === 'expired' || timing.expired) {
      recapture.push('preview_expired')
    }
    const canRecapture = !archived
      && candidate.effective_status !== 'suppressed'
      && candidate.effective_status !== 'converted'
      && candidate.preview?.status === 'failed'
      && timing.expiry_valid
      && !timing.expired
    if (!canRecapture) recapture.push('recapture_not_available')

    if (candidate.effective_status === 'suppressed') renew.push('suppressed')
    if (candidate.effective_status === 'converted') renew.push('converted')
    if (candidate.effective_status === 'preview_generating' || candidate.preview?.status === 'generating') {
      renew.push('preview_generating')
    }
    if (candidate.effective_status === 'failed' || candidate.preview?.status === 'failed') renew.push('preview_failed')
    if (!timing.expiry_valid) renew.push('preview_not_ready')
    const canRenew = !archived
      && candidate.effective_status !== 'suppressed'
      && candidate.effective_status !== 'converted'
      && candidate.preview !== null
      && (candidate.preview.status === 'ready' || candidate.preview.status === 'expired')
      && timing.expiry_valid
      && timing.in_renewal_window
    if (!canRenew) renew.push('renewal_not_available')
  }

  if (input.suppression.target === null) suppress.push('suppression_target_unavailable')
  if (!input.suppression.reason_valid) suppress.push('suppression_reason_invalid')
  if (!input.suppression.confirmed) suppress.push('suppression_confirmation_required')

  return {
    load: input.load,
    effective: candidate?.effective_status ?? null,
    persisted: candidate?.persisted_status ?? null,
    campaign: candidate?.campaign.status ?? null,
    action: input.action,
    refresh_required: input.refresh_required,
    edits: { ...input.edits },
    blockers: {
      approve: ordered(approve),
      export: ordered(exportBlockers),
      recapture: ordered(recapture),
      renew: ordered(renew),
      suppress: ordered(suppress),
    },
    audit,
    timing,
  }
}
