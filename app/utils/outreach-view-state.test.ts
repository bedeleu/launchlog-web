import { describe, expect, test } from 'bun:test'

type CampaignStatus = 'draft' | 'active' | 'archived'
type PersistedStatus = 'draft' | 'ready_for_review' | 'approved' | 'exported'
type EffectiveStatus = 'draft' | 'preview_generating' | 'ready_for_review' | 'approved' | 'exported' | 'failed' | 'expired' | 'suppressed' | 'converted'
type PreviewStatus = 'generating' | 'ready' | 'failed' | 'converted' | 'expired'
type EditState = 'clean' | 'dirty' | 'saving' | 'stale' | 'save_error'
type ActionName = 'refresh' | 'activate_campaign' | 'save_prospect' | 'save_draft' | 'approve' | 'recapture' | 'renew' | 'suppress' | 'export'
type ActionState =
  | { name: null, phase: 'idle' }
  | { name: ActionName, phase: 'pending' | 'success' | 'validation_error' | 'action_error' }

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
    status: PreviewStatus
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

interface ViewInput {
  candidate: Candidate | null
  load: 'idle' | 'loading' | 'ready' | 'load_error'
  action: ActionState
  refresh_required: boolean
  edits: { prospect: EditState, draft: EditState }
  confirmations: {
    approval_english_plain_text: boolean
    approval_public_source: boolean
    reexport: boolean
  }
  suppression: {
    target: 'email' | 'product_domain' | 'effective_domain' | null
    reason_valid: boolean
    source: 'manual' | 'opt_out'
    confirmed: boolean
  }
  nowMs: number
}

interface ViewState {
  load: ViewInput['load']
  effective: EffectiveStatus | null
  persisted: PersistedStatus | null
  campaign: CampaignStatus | null
  action: ActionState
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

interface OutreachViewStateModule {
  OUTREACH_BLOCKER_ORDER: readonly string[]
  outreachViewState: (input: ViewInput) => ViewState
}

const modulePath = ['./outreach-view-state', 'ts'].join('.')
const subject = await import(modulePath) as OutreachViewStateModule

const NOW = Date.parse('2026-08-26T12:00:00.000Z')
const HOUR = 60 * 60 * 1000
const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'

function isoFromNow(hours: number, extraMs = 0): string {
  return new Date(NOW + hours * HOUR + extraMs).toISOString()
}

function readyCandidate(overrides: Partial<Candidate> = {}): Candidate {
  const candidate: Candidate = {
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
      product_url: 'https://acme.test',
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
      preview_url: 'https://launchlog.ai/preview/token',
      url: 'https://acme.test',
      normalized_domain: 'acme.test',
      title: 'Acme Launch',
      tagline: 'Ship clearly',
      description: 'A focused launch tool.',
      screenshot_url: 'https://cdn.launchlog.ai/acme.png',
      error: null,
      expires_at: isoFromNow(72),
      capabilities: { edit: false, recapture: false, checkout: true },
    },
    draft: {
      subject_line: 'A private preview for Acme',
      opening_line: 'Hi Ada, I found Acme in the public directory.',
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

  return { ...candidate, ...overrides }
}

function input(candidate: Candidate | null = readyCandidate(), overrides: Partial<ViewInput> = {}): ViewInput {
  const defaults: ViewInput = {
    candidate,
    load: candidate === null ? 'idle' : 'ready',
    action: { name: null, phase: 'idle' },
    refresh_required: false,
    edits: { prospect: 'clean', draft: 'clean' },
    confirmations: {
      approval_english_plain_text: true,
      approval_public_source: true,
      reexport: false,
    },
    suppression: {
      target: 'email',
      reason_valid: true,
      source: 'manual',
      confirmed: true,
    },
    nowMs: NOW,
  }

  return { ...defaults, ...overrides }
}

function preview(candidate: Candidate, status: PreviewStatus, expiresAt: string | null): Candidate {
  if (candidate.preview === null) {
    throw new Error('Fixture requires a preview.')
  }

  return {
    ...candidate,
    preview: { ...candidate.preview, status, expires_at: expiresAt },
  }
}

function approvedCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return readyCandidate({
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

describe('outreachViewState independent axes', () => {
  test('return empty audit and timing without fabricating a candidate', () => {
    const state = subject.outreachViewState(input(null, { load: 'loading' }))

    expect(state.load).toBe('loading')
    expect(state.effective).toBeNull()
    expect(state.persisted).toBeNull()
    expect(state.campaign).toBeNull()
    expect(state.blockers.approve).toContain('not_loaded')
    expect(state.blockers.export).toContain('not_loaded')
    expect(state.blockers.recapture).toContain('not_loaded')
    expect(state.blockers.renew).toContain('not_loaded')
    expect(state.blockers.suppress).toContain('not_loaded')
    expect(state.audit).toEqual({
      approved_at: null,
      approved_by: null,
      exported_at: null,
      exported_by: null,
      export_count: 0,
      last_export_hash: null,
      requires_reexport_confirmation: false,
    })
    expect(state.timing).toEqual({
      expires_at: null,
      expiry_valid: false,
      remaining_ms: null,
      expired: false,
      has_review_window: false,
      in_renewal_window: false,
    })
  })

  test('preserve load, status, action, edit, and audit as independent axes', () => {
    const candidate = approvedCandidate()
    const state = subject.outreachViewState(input(candidate, {
      load: 'load_error',
      action: { name: 'export', phase: 'action_error' },
      edits: { prospect: 'dirty', draft: 'save_error' },
    }))

    expect(state.load).toBe('load_error')
    expect(state.effective).toBe('approved')
    expect(state.persisted).toBe('approved')
    expect(state.campaign).toBe('active')
    expect(state.action).toEqual({ name: 'export', phase: 'action_error' })
    expect(state.edits).toEqual({ prospect: 'dirty', draft: 'save_error' })
    expect(state.audit.approved_at).toBe('2026-08-26T11:00:00.000Z')
    expect(state.audit.approved_by).toEqual({ name: 'Admin', email: 'admin@launchlog.ai' })
  })
})

describe('campaign and effective-state matrix', () => {
  test('allow draft-campaign review but block export as inactive', () => {
    const candidate = readyCandidate({
      campaign: { ...readyCandidate().campaign, status: 'draft' },
    })
    const state = subject.outreachViewState(input(candidate))

    expect(state.blockers.approve).not.toContain('campaign_inactive')
    expect(state.blockers.approve).toEqual([])
    expect(state.blockers.export).toContain('campaign_inactive')
  })

  test('block archived candidate work while preserving suppression and audit', () => {
    const candidate = approvedCandidate({
      campaign: { ...readyCandidate().campaign, status: 'archived' },
    })
    const state = subject.outreachViewState(input(candidate))

    const archivedActions: Array<keyof ViewState['blockers']> = ['approve', 'export', 'recapture', 'renew']
    for (const action of archivedActions) {
      expect(state.blockers[action]).toContain('campaign_archived')
    }
    expect(state.blockers.suppress).not.toContain('campaign_archived')
    expect(state.audit.approved_at).not.toBeNull()
  })

  test('keep converted and suppressed history while allowing revision-bound suppression', () => {
    const converted = subject.outreachViewState(input(approvedCandidate({ effective_status: 'converted' })))
    expect(converted.blockers.approve).toContain('converted')
    expect(converted.blockers.export).toContain('converted')
    expect(converted.blockers.recapture).toContain('converted')
    expect(converted.blockers.renew).toContain('converted')
    expect(converted.blockers.suppress).toEqual([])
    expect(converted.audit.approved_at).not.toBeNull()

    const suppressed = subject.outreachViewState(input(approvedCandidate({
      persisted_status: 'exported',
      effective_status: 'suppressed',
      audit: {
        approved_at: '2026-08-26T10:00:00.000Z',
        approved_by: { name: 'Admin', email: null },
        exported_at: '2026-08-26T11:00:00.000Z',
        exported_by: { name: 'Admin', email: null },
        export_count: 2,
        last_export_hash: 'a'.repeat(64),
      },
    })))
    expect(suppressed.blockers.export).toContain('suppressed')
    expect(suppressed.blockers.suppress).toEqual([])
    expect(suppressed.audit.export_count).toBe(2)
    expect(suppressed.audit.last_export_hash).toBe('a'.repeat(64))
    expect(suppressed.audit.requires_reexport_confirmation).toBeTrue()
  })

  test('match generating, failed, expired, and ready preview actions', () => {
    const generatingCandidate = preview(readyCandidate({ effective_status: 'preview_generating' }), 'generating', isoFromNow(72))
    const generating = subject.outreachViewState(input(generatingCandidate))
    expect(generating.blockers.approve).toContain('preview_generating')
    expect(generating.blockers.export).toContain('preview_generating')
    expect(generating.blockers.suppress).toEqual([])

    const failedCandidate = preview(readyCandidate({ effective_status: 'failed', persisted_status: 'draft' }), 'failed', isoFromNow(72))
    const failed = subject.outreachViewState(input(failedCandidate))
    expect(failed.blockers.approve).toContain('preview_failed')
    expect(failed.blockers.recapture).toEqual([])
    expect(failed.blockers.renew).toContain('renewal_not_available')

    const expiredCandidate = preview(readyCandidate({ effective_status: 'expired', persisted_status: 'draft' }), 'expired', isoFromNow(-1))
    const expired = subject.outreachViewState(input(expiredCandidate))
    expect(expired.blockers.approve).toContain('preview_expired')
    expect(expired.blockers.recapture).toContain('recapture_not_available')
    expect(expired.blockers.renew).toEqual([])

    const ready = subject.outreachViewState(input(readyCandidate()))
    expect(ready.blockers.approve).toEqual([])
    expect(ready.blockers.recapture).toContain('recapture_not_available')
    expect(ready.blockers.renew).toContain('renewal_not_available')
  })

  test('ignore managed public recapture capability for authenticated failed-preview recapture', () => {
    const candidate = preview(readyCandidate({ effective_status: 'failed', persisted_status: 'draft' }), 'failed', isoFromNow(12))
    expect(candidate.preview?.capabilities.recapture).toBeFalse()
    expect(subject.outreachViewState(input(candidate)).blockers.recapture).toEqual([])
  })
})

describe('timing boundaries', () => {
  test('treat exact 24 hours as reviewable and one millisecond under as blocked', () => {
    const exact = preview(readyCandidate(), 'ready', isoFromNow(24))
    const under = preview(readyCandidate(), 'ready', isoFromNow(24, -1))
    const exactState = subject.outreachViewState(input(exact))
    const underState = subject.outreachViewState(input(under))

    expect(exactState.timing.remaining_ms).toBe(24 * HOUR)
    expect(exactState.timing.has_review_window).toBeTrue()
    expect(exactState.blockers.approve).not.toContain('ttl_under_24h')
    expect(underState.timing.remaining_ms).toBe(24 * HOUR - 1)
    expect(underState.timing.has_review_window).toBeFalse()
    expect(underState.blockers.approve).toContain('ttl_under_24h')
    expect(underState.blockers.export).toContain('ttl_under_24h')
  })

  test('enable renewal at exact 48 hours and disable it one millisecond over', () => {
    const exact = preview(readyCandidate(), 'ready', isoFromNow(48))
    const over = preview(readyCandidate(), 'ready', isoFromNow(48, 1))

    expect(subject.outreachViewState(input(exact)).blockers.renew).toEqual([])
    expect(subject.outreachViewState(input(over)).blockers.renew).toContain('renewal_not_available')
  })

  test('treat zero remaining time as expired and invalid dates as fail-closed', () => {
    const exactExpiry = preview(readyCandidate({ effective_status: 'expired', persisted_status: 'draft' }), 'expired', isoFromNow(0))
    const expiredState = subject.outreachViewState(input(exactExpiry))
    expect(expiredState.timing.expired).toBeTrue()
    expect(expiredState.timing.in_renewal_window).toBeTrue()
    expect(expiredState.blockers.renew).toEqual([])

    for (const expiresAt of [null, 'not-a-date', '275760-09-13T00:00:00.000Z']) {
      const invalid = preview(readyCandidate(), 'ready', expiresAt)
      const state = subject.outreachViewState(input(invalid))
      expect(state.timing.expiry_valid).toBeFalse()
      expect(state.timing.remaining_ms).toBeNull()
      expect(state.timing.expired).toBeFalse()
      expect(state.timing.has_review_window).toBeFalse()
      expect(state.timing.in_renewal_window).toBeFalse()
      expect(state.blockers.approve).toContain('preview_not_ready')
      expect(state.blockers.export).toContain('preview_not_ready')
      expect(state.blockers.renew).toContain('renewal_not_available')
    }
  })
})

describe('validation, confirmation, and concurrency blockers', () => {
  test('block invalid drafts and every non-clean edit phase independently', () => {
    const invalidDraft = readyCandidate({ validation_errors: { email_body: ['Safe validation message.'] } })
    const invalidState = subject.outreachViewState(input(invalidDraft))
    expect(invalidState.blockers.approve).toContain('invalid_draft')
    expect(invalidState.blockers.export).toContain('invalid_draft')

    const blockedEditPhases: EditState[] = ['dirty', 'saving', 'stale', 'save_error']
    for (const phase of blockedEditPhases) {
      const prospect = subject.outreachViewState(input(readyCandidate(), { edits: { prospect: phase, draft: 'clean' } }))
      const draft = subject.outreachViewState(input(readyCandidate(), { edits: { prospect: 'clean', draft: phase } }))
      expect(prospect.blockers.approve).toContain('prospect_not_clean')
      expect(prospect.blockers.export).toContain('prospect_not_clean')
      expect(draft.blockers.approve).toContain('draft_not_clean')
      expect(draft.blockers.export).toContain('draft_not_clean')
      if (phase === 'stale') {
        expect(prospect.blockers.approve).toContain('stale_revision')
        expect(draft.blockers.suppress).toContain('stale_revision')
      }
    }
  })

  test('require ready-for-review status and both approval confirmations', () => {
    const missingEnglish = subject.outreachViewState(input(readyCandidate(), {
      confirmations: {
        approval_english_plain_text: false,
        approval_public_source: true,
        reexport: false,
      },
    }))
    expect(missingEnglish.blockers.approve).toContain('approval_confirmation_required')

    for (const candidate of [approvedCandidate(), approvedCandidate({ persisted_status: 'exported', effective_status: 'exported' })]) {
      expect(subject.outreachViewState(input(candidate)).blockers.approve).toContain('approval_not_available')
    }
  })

  test('allow first export after approval and bind every later export to explicit confirmation', () => {
    const approved = subject.outreachViewState(input(approvedCandidate()))
    expect(approved.blockers.export).toEqual([])

    const exportedCandidate = approvedCandidate({
      persisted_status: 'exported',
      effective_status: 'exported',
      audit: {
        approved_at: '2026-08-26T10:00:00.000Z',
        approved_by: { name: 'Admin', email: null },
        exported_at: '2026-08-26T11:00:00.000Z',
        exported_by: { name: 'Admin', email: null },
        export_count: 1,
        last_export_hash: 'b'.repeat(64),
      },
    })
    const unconfirmed = subject.outreachViewState(input(exportedCandidate))
    expect(unconfirmed.blockers.export).toContain('reexport_confirmation_required')
    expect(unconfirmed.audit.requires_reexport_confirmation).toBeTrue()

    const confirmed = subject.outreachViewState(input(exportedCandidate, {
      confirmations: {
        approval_english_plain_text: true,
        approval_public_source: true,
        reexport: true,
      },
    }))
    expect(confirmed.blockers.export).toEqual([])
  })

  test('bind suppression to a target, valid reason, and current confirmation', () => {
    const missingTarget = subject.outreachViewState(input(readyCandidate(), {
      suppression: { target: null, reason_valid: true, source: 'manual', confirmed: true },
    }))
    const invalidReason = subject.outreachViewState(input(readyCandidate(), {
      suppression: { target: 'email', reason_valid: false, source: 'manual', confirmed: true },
    }))
    const unconfirmed = subject.outreachViewState(input(readyCandidate(), {
      suppression: { target: 'email', reason_valid: true, source: 'opt_out', confirmed: false },
    }))

    expect(missingTarget.blockers.suppress).toEqual(['suppression_target_unavailable'])
    expect(invalidReason.blockers.suppress).toEqual(['suppression_reason_invalid'])
    expect(unconfirmed.blockers.suppress).toEqual(['suppression_confirmation_required'])
  })

  test('apply pending and refresh-required gates to every mutation blocker array', () => {
    const state = subject.outreachViewState(input(approvedCandidate(), {
      action: { name: 'export', phase: 'pending' },
      refresh_required: true,
    }))

    for (const blockers of Object.values(state.blockers)) {
      expect(blockers).toContain('action_pending')
      expect(blockers).toContain('refresh_required')
    }
  })

  test('emit the exact blocker vocabulary once and in canonical order', () => {
    expect(subject.OUTREACH_BLOCKER_ORDER).toEqual([
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
    ])

    const candidate = preview(readyCandidate({
      campaign: { ...readyCandidate().campaign, status: 'archived' },
      persisted_status: 'draft',
      effective_status: 'suppressed',
      validation_errors: { subject_line: ['Invalid.'] },
    }), 'expired', isoFromNow(-1))
    const state = subject.outreachViewState(input(candidate, {
      action: { name: 'suppress', phase: 'pending' },
      refresh_required: true,
      edits: { prospect: 'stale', draft: 'dirty' },
      confirmations: {
        approval_english_plain_text: false,
        approval_public_source: false,
        reexport: false,
      },
      suppression: { target: null, reason_valid: false, source: 'manual', confirmed: false },
    }))

    for (const blockers of Object.values(state.blockers)) {
      expect(new Set(blockers).size).toBe(blockers.length)
      const indexes = blockers.map(blocker => subject.OUTREACH_BLOCKER_ORDER.indexOf(blocker))
      expect(indexes).toEqual([...indexes].sort((left, right) => left - right))
    }
  })

  test('never expose sender-lifecycle vocabulary as state, action, or blocker names', () => {
    const vocabulary = JSON.stringify({
      blockers: subject.OUTREACH_BLOCKER_ORDER,
      state: subject.outreachViewState(input(readyCandidate())),
    }).toLowerCase()

    for (const forbidden of ['send', 'contacted', 'delivered', 'replied']) {
      expect(vocabulary).not.toContain(forbidden)
    }
  })
})
