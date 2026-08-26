import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import { defineComponent, nextTick, reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import AppBar from '../../app/components/AppBar.vue'
import PlacementPreview from '../../app/components/Intake/PlacementPreview.vue'
import AdminPage from '../../app/pages/admin.vue'
import { OutreachApiError } from '../../app/composables/useAdminOutreach'
import type {
  AdminOutreachClient,
  OutreachCampaign,
  OutreachCandidateDetail,
  OutreachCandidatePage,
  OutreachCandidateSummary,
  OutreachSuppressionPage,
} from '../../app/composables/useAdminOutreach'
import type {
  OutreachCandidatePageController,
  OutreachCandidatePageState,
  OutreachDraftForm,
  OutreachProspectForm,
} from '../../app/composables/useOutreachCandidatePage'
import { outreachViewState } from '../../app/utils/outreach-view-state'

interface TestRouteState {
  path: string
  fullPath: string
  params: Record<string, unknown>
  query: Record<string, unknown>
}

const testDoubles = vi.hoisted(() => {
  const ioViolations: string[] = []
  const firebaseApp = Object.freeze({ name: 'launchlog-mounted-test' })
  const firebaseAuthObject = Object.freeze({ currentUser: null })
  const rejectIo = (operation: string): never => {
    ioViolations.push(operation)
    throw new Error(`Unexpected ${operation}`)
  }
  const firebaseApps = vi.fn((...args: unknown[]) => {
    if (args.length !== 0) return rejectIo('Firebase getApps arguments')
    return []
  })
  const firebaseInitialize = vi.fn((config: unknown, ...args: unknown[]) => {
    const expectedKeys = ['apiKey', 'appId', 'authDomain', 'messagingSenderId', 'projectId', 'storageBucket']
    if (
      args.length !== 0
      || typeof config !== 'object'
      || config === null
      || Object.keys(config).sort().join(',') !== expectedKeys.sort().join(',')
      || Object.values(config).some(value => value !== undefined && typeof value !== 'string')
    ) return rejectIo('Firebase initializeApp arguments')
    return firebaseApp
  })
  const firebaseAuth = vi.fn((app: unknown, ...args: unknown[]) => {
    if (app !== firebaseApp || args.length !== 0) return rejectIo('Firebase getAuth arguments')
    return firebaseAuthObject
  })
  const firebaseProvider = vi.fn(function GoogleAuthProviderGuard(...args: unknown[]) {
    if (args.length !== 0) return rejectIo('Firebase GoogleAuthProvider arguments')
  })
  const firebaseStateChange = vi.fn((auth: unknown, callback: unknown, ...args: unknown[]) => {
    if (auth !== firebaseAuthObject || typeof callback !== 'function' || args.length !== 0) {
      return rejectIo('Firebase onAuthStateChanged arguments')
    }
    return () => {}
  })
  const firebaseForbidden = vi.fn((operation: string): never => rejectIo(`Firebase ${operation}`))

  return {
    route: { path: '/admin/outreach', fullPath: '/admin/outreach', params: {}, query: {} } as TestRouteState,
    routerReplace: vi.fn(),
    navigateTo: vi.fn(),
    useAdminOutreach: vi.fn(),
    useOutreachCandidatePage: vi.fn(),
    validateCommittedRecovery: vi.fn(),
    useAuth: vi.fn(),
    useAdminListings: vi.fn(),
    ioViolations,
    firebaseInitialize,
    firebaseApps,
    firebaseAuth,
    firebaseProvider,
    firebaseStateChange,
    firebaseForbidden,
  }
})

mockNuxtImport('useRoute', original => () => {
  const route = original()
  return new Proxy(route, {
    get(target, property, receiver) {
      if (property in testDoubles.route) return Reflect.get(testDoubles.route, property)
      return Reflect.get(target, property, receiver)
    },
  })
})
mockNuxtImport('useRouter', original => () => {
  const router = original()
  return new Proxy(router, {
    get(target, property, receiver) {
      if (property === 'replace') return testDoubles.routerReplace
      return Reflect.get(target, property, receiver)
    },
  })
})
mockNuxtImport('navigateTo', () => testDoubles.navigateTo)
mockNuxtImport('useAdminOutreach', () => testDoubles.useAdminOutreach)
mockNuxtImport('useOutreachCandidatePage', () => testDoubles.useOutreachCandidatePage)
mockNuxtImport('validateCommittedRecovery', () => testDoubles.validateCommittedRecovery)
mockNuxtImport('useAuth', () => testDoubles.useAuth)
mockNuxtImport('useAdminListings', () => testDoubles.useAdminListings)

vi.mock('firebase/app', () => ({
  getApps: testDoubles.firebaseApps,
  initializeApp: testDoubles.firebaseInitialize,
}))

vi.mock('firebase/auth', () => ({
  getAuth: testDoubles.firebaseAuth,
  GoogleAuthProvider: testDoubles.firebaseProvider,
  onAuthStateChanged: testDoubles.firebaseStateChange,
  getIdToken: () => testDoubles.firebaseForbidden('getIdToken'),
  signInWithPopup: () => testDoubles.firebaseForbidden('signInWithPopup'),
  sendSignInLinkToEmail: () => testDoubles.firebaseForbidden('sendSignInLinkToEmail'),
  isSignInWithEmailLink: () => testDoubles.firebaseForbidden('isSignInWithEmailLink'),
  signInWithEmailLink: () => testDoubles.firebaseForbidden('signInWithEmailLink'),
  signOut: () => testDoubles.firebaseForbidden('signOut'),
}))

type VueModule = { default: Component }

const outreachPages = import.meta.glob('../../app/pages/admin/outreach/*.vue', { eager: true }) as Record<string, VueModule>
const adminComponents = import.meta.glob('../../app/components/Admin/OutreachCandidateForm.vue', { eager: true }) as Record<string, VueModule>

const missingComponent = (name: string): Component => defineComponent({
  name: `Missing${name}`,
  template: `<section :data-missing="name" />`,
  setup: () => ({ name }),
})

const ListPage = outreachPages['../../app/pages/admin/outreach/index.vue']?.default ?? missingComponent('OutreachListPage')
const NewPage = outreachPages['../../app/pages/admin/outreach/new.vue']?.default ?? missingComponent('OutreachNewPage')
const DetailPage = outreachPages['../../app/pages/admin/outreach/[publicId].vue']?.default ?? missingComponent('OutreachDetailPage')
const CandidateForm = adminComponents['../../app/components/Admin/OutreachCandidateForm.vue']?.default ?? missingComponent('OutreachCandidateForm')

const NOW = Date.parse('2026-08-26T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const PUBLIC_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const OTHER_PUBLIC_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAW'
const BUSINESS_EMAIL = ['owner', 'example.invalid'].join('@')
const AUDIT_HASH = 'a'.repeat(64)
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
let originalSendBeaconDescriptor: PropertyDescriptor | undefined

interface FirebaseCallCounts {
  apps: number
  initialize: number
  auth: number
  provider: number
  stateChange: number
}

const trackedTaskWrappers = new Set<VueWrapper>()
let acceptedFirebaseCalls: FirebaseCallCounts

function publicIdAt(index: number): string {
  return `${PUBLIC_ID.slice(0, 24)}${ULID_ALPHABET[Math.floor(index / ULID_ALPHABET.length)]}${ULID_ALPHABET[index % ULID_ALPHABET.length]}`
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function campaign(overrides: Partial<OutreachCampaign> = {}): OutreachCampaign {
  return {
    name: 'Founder signals',
    key: 'founder-signals',
    status: 'active',
    sender_identity_label: 'Founder research',
    candidate_count: 1,
    created_at: '2026-08-20T10:00:00.000Z',
    updated_at: '2026-08-20T10:00:00.000Z',
    ...overrides,
  }
}

function summary(overrides: Partial<OutreachCandidateSummary> = {}): OutreachCandidateSummary {
  return {
    public_id: PUBLIC_ID,
    campaign_key: 'founder-signals',
    campaign_status: 'active',
    company_name: 'Example Labs',
    product_name: 'Signal Desk',
    product_url: 'https://product.example.invalid',
    normalized_domain: 'product.example.invalid',
    business_email_masked: 'o***r@example.invalid',
    country_code: 'US',
    persisted_status: 'approved',
    effective_status: 'approved',
    preview_status: 'ready',
    expires_at: new Date(NOW + 3 * DAY).toISOString(),
    revision: 7,
    failure_code: null,
    approved_at: '2026-08-25T10:00:00.000Z',
    exported_at: null,
    export_count: 0,
    created_at: '2026-08-20T10:00:00.000Z',
    updated_at: '2026-08-25T10:00:00.000Z',
    ...overrides,
  }
}

function candidate(overrides: Partial<OutreachCandidateDetail> = {}): OutreachCandidateDetail {
  const base: OutreachCandidateDetail = {
    public_id: PUBLIC_ID,
    campaign: {
      name: 'Founder signals',
      key: 'founder-signals',
      status: 'active',
      sender_identity_label: 'Founder research',
    },
    prospect: {
      company_name: 'Example Labs',
      product_name: 'Signal Desk',
      product_url: 'https://product.example.invalid',
      normalized_domain: 'product.example.invalid',
      founder_first_name: 'Avery',
      business_email: BUSINESS_EMAIL,
      country_code: 'US',
      source_url: 'https://evidence.example.invalid/release',
      source_context: 'Public product launch announcement.',
      notes: null,
      source_attested_at: '2026-08-20T10:00:00.000Z',
      source_attested_by: { name: 'Reviewer', email: null },
    },
    persisted_status: 'ready_for_review',
    effective_status: 'ready_for_review',
    revision: 7,
    failure: null,
    preview: {
      status: 'ready',
      preview_url: 'https://launchlog.ai/preview/managed',
      url: 'https://product.example.invalid',
      normalized_domain: 'product.example.invalid',
      title: 'Signal Desk',
      tagline: 'A calm operations surface.',
      description: 'A private managed preview.',
      screenshot_url: 'https://assets.example.invalid/screenshot.webp',
      error: null,
      expires_at: new Date(NOW + 3 * DAY).toISOString(),
      capabilities: { edit: false, recapture: false, checkout: true },
    },
    draft: {
      subject_line: 'A private LaunchLog preview',
      opening_line: 'Your public launch caught our attention.',
      email_body: 'We prepared a private placement preview for your review.',
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
    created_at: '2026-08-20T10:00:00.000Z',
    updated_at: '2026-08-25T10:00:00.000Z',
  }

  return { ...base, ...overrides }
}

function page(rows: OutreachCandidateSummary[] = []): OutreachCandidatePage {
  return {
    data: rows,
    links: { first: '/first', last: '/last', prev: null, next: null },
    meta: {
      current_page: 1,
      from: rows.length === 0 ? null : 1,
      last_page: 1,
      links: [],
      path: '/api/v1/admin/outreach/candidates',
      per_page: 30,
      to: rows.length === 0 ? null : rows.length,
      total: rows.length,
    },
  }
}

function api(overrides: Partial<AdminOutreachClient> = {}): AdminOutreachClient {
  return {
    listCampaigns: vi.fn().mockResolvedValue([campaign()]),
    createCampaign: vi.fn().mockResolvedValue(campaign()),
    updateCampaign: vi.fn().mockResolvedValue(campaign()),
    listCandidates: vi.fn().mockResolvedValue(page()),
    createCandidate: vi.fn().mockResolvedValue(candidate()),
    getCandidate: vi.fn().mockResolvedValue(candidate()),
    updateProspect: vi.fn().mockResolvedValue(candidate()),
    updateDraft: vi.fn().mockResolvedValue(candidate()),
    approveCandidate: vi.fn().mockResolvedValue(candidate()),
    recaptureCandidate: vi.fn().mockResolvedValue(candidate()),
    renewCandidate: vi.fn().mockResolvedValue(candidate()),
    listSuppressions: vi.fn().mockResolvedValue(page() as unknown as OutreachSuppressionPage),
    createSuppression: vi.fn().mockResolvedValue({}),
    exportCandidates: vi.fn().mockResolvedValue({
      blob: new Blob(['safe'], { type: 'text/csv' }),
      filename: 'launchlog-outreach.csv',
    }),
    ...overrides,
  } as AdminOutreachClient
}

function controller(detail: OutreachCandidateDetail = candidate()): OutreachCandidatePageController {
  const state = reactive({
    candidate: detail,
    load: 'ready',
    prospect_form: {
      company_name: detail.prospect.company_name,
      product_name: detail.prospect.product_name,
      founder_first_name: detail.prospect.founder_first_name,
      business_email: detail.prospect.business_email,
      country_code: detail.prospect.country_code,
      source_url: detail.prospect.source_url,
      source_context: detail.prospect.source_context,
      notes: detail.prospect.notes,
    },
    draft_form: detail.draft === null
      ? { subject_line: '', opening_line: '', email_body: '' }
      : { ...detail.draft },
    prospect_edit: 'clean',
    draft_edit: 'clean',
    suppression_draft: { target: null, reason: '', source: 'manual', confirmed: false, confirmed_revision: null },
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
  }) as unknown as OutreachCandidatePageState

  Object.defineProperty(state, 'suppression_dirty', {
    enumerable: true,
    get: () => state.suppression_draft.target !== null || state.suppression_draft.reason !== '',
  })
  Object.defineProperty(state, 'view', {
    enumerable: true,
    get: () => outreachViewState({
      candidate: state.candidate,
      load: state.load,
      action: state.action,
      refresh_required: state.refresh_required,
      edits: { prospect: state.prospect_edit, draft: state.draft_edit },
      confirmations: {
        approval_english_plain_text: state.approval_english_plain_text,
        approval_public_source: state.approval_public_source,
        reexport: state.reexport_confirmed,
      },
      suppression: {
        target: state.suppression_draft.target,
        reason_valid: state.suppression_draft.reason.trim().length > 0,
        source: state.suppression_draft.source,
        confirmed: state.suppression_draft.confirmed,
      },
      nowMs: NOW,
    }),
  })

  return {
    state,
    load: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockImplementation(async () => {
      if (state.prospect_edit === 'dirty' || state.draft_edit === 'dirty' || state.suppression_dirty) {
        state.discard_confirmation_required = true
      }
    }),
    confirmDiscardAndRefresh: vi.fn().mockImplementation(async () => {
      state.discard_confirmation_required = false
      state.prospect_edit = 'clean'
      state.draft_edit = 'clean'
      if (state.candidate) {
        state.prospect_form = {
          company_name: state.candidate.prospect.company_name,
          product_name: state.candidate.prospect.product_name,
          founder_first_name: state.candidate.prospect.founder_first_name,
          business_email: state.candidate.prospect.business_email,
          country_code: state.candidate.prospect.country_code,
          source_url: state.candidate.prospect.source_url,
          source_context: state.candidate.prospect.source_context,
          notes: state.candidate.prospect.notes,
        }
        state.draft_form = state.candidate.draft ?? { subject_line: '', opening_line: '', email_body: '' }
      }
      state.suppression_draft = { target: null, reason: '', source: 'manual', confirmed: false, confirmed_revision: null }
    }),
    cancelDiscardRefresh: vi.fn(() => { state.discard_confirmation_required = false }),
    setProspectField: vi.fn((field: keyof OutreachProspectForm, value: string | null) => {
      state.prospect_form[field] = value as never
      state.prospect_edit = 'dirty'
      state.approval_english_plain_text = false
      state.approval_public_source = false
    }),
    setDraftField: vi.fn((field: keyof OutreachDraftForm, value: string) => {
      state.draft_form[field] = value
      state.draft_edit = 'dirty'
      state.approval_english_plain_text = false
      state.approval_public_source = false
    }),
    saveProspect: vi.fn().mockImplementation(async () => { state.prospect_edit = 'clean' }),
    saveDraft: vi.fn().mockImplementation(async () => { state.draft_edit = 'clean' }),
    setApprovalEnglishPlainText: vi.fn((value) => { state.approval_english_plain_text = value }),
    setApprovalPublicSource: vi.fn((value) => { state.approval_public_source = value }),
    approve: vi.fn().mockResolvedValue(undefined),
    setCampaignActivationConfirmed: vi.fn((value) => { state.campaign_activation_confirmed = value }),
    activateCampaign: vi.fn().mockResolvedValue(undefined),
    recapture: vi.fn().mockResolvedValue(undefined),
    renew: vi.fn().mockResolvedValue(undefined),
    setSuppressionTarget: vi.fn((value) => {
      state.suppression_draft.target = value
      state.suppression_draft.confirmed = false
      state.suppression_draft.confirmed_revision = null
    }),
    setSuppressionReason: vi.fn((value) => {
      state.suppression_draft.reason = value
      state.suppression_draft.confirmed = false
      state.suppression_draft.confirmed_revision = null
    }),
    setSuppressionSource: vi.fn((value) => {
      state.suppression_draft.source = value
      state.suppression_draft.confirmed = false
      state.suppression_draft.confirmed_revision = null
    }),
    setSuppressionConfirmed: vi.fn((value) => {
      state.suppression_draft.confirmed = value
      state.suppression_draft.confirmed_revision = value ? state.candidate?.revision ?? null : null
    }),
    suppress: vi.fn().mockResolvedValue(undefined),
    setReexportConfirmed: vi.fn((value) => { state.reexport_confirmed = value }),
    exportCandidate: vi.fn().mockResolvedValue({
      blob: new Blob(['safe'], { type: 'text/csv' }),
      filename: 'launchlog-outreach.csv',
    }),
    dispose: vi.fn(),
  }
}

function dashboardApi() {
  return {
    dashboard: vi.fn().mockResolvedValue({
      totals: { listings: 0, published: 0, pending_review: 0, with_screenshots: 0, missing_screenshots: 0, founding_missing_screenshots: 0 },
      coverage: { published_percent: 0, screenshot_percent: 0 },
      tier_counts: {},
      status_counts: {},
      source_counts: {},
      recent_listings: [],
    }),
    runFounderScreenshots: vi.fn().mockResolvedValue({ pid: 1 }),
    founderScreenshotStatus: vi.fn().mockRejectedValue(new Error('No batch')),
  }
}

async function settle(): Promise<void> {
  await flushPromises()
  await nextTick()
  assertTrackedTaskSurfaces()
}

function accessibleNameOf(wrapper: VueWrapper, control: DOMWrapper<Element>): string {
  const ariaLabel = control.attributes('aria-label')?.trim()
  if (ariaLabel) return ariaLabel

  const labelledBy = control.attributes('aria-labelledby')?.trim()
  if (labelledBy) {
    const ids = new Set(labelledBy.split(/\s+/))
    const text = wrapper.findAll('[id]')
      .filter((item) => {
        const id = item.attributes('id')
        return id !== undefined && ids.has(id)
      })
      .map(item => item.text().trim())
      .filter(Boolean)
      .join(' ')
    if (text) return text
  }

  const id = control.attributes('id')
  if (id) {
    const text = wrapper.findAll('label')
      .filter(label => label.attributes('for') === id)
      .map(label => label.text().trim())
      .filter(Boolean)
      .join(' ')
    if (text) return text
  }

  const wrappingLabel = control.element.closest('label')?.textContent?.trim()
  if (wrappingLabel) return wrappingLabel
  return control.element.textContent?.trim() ?? ''
}

function politeAnnouncer(wrapper: VueWrapper): DOMWrapper<Element> {
  const regions = wrapper.findAll('[aria-live="polite"][aria-atomic="true"]')
  expect(regions, 'outreach pages require exactly one stable polite announcer').toHaveLength(1)
  return regions[0]!
}

function assertNoDeliverySurface(wrapper: VueWrapper): void {
  const forbiddenAction = /(?:^(?:send|email|deliver|resend|attach|track)\b|\b(?:activate|import(?:\s+to|\s+into)?)\s+smartlead\b)/i
  for (const control of wrapper.findAll([
    'a[href]',
    'button',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    '[contenteditable="true"]',
    '[role="button"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
  ].join(', '))) {
    const accessibleName = accessibleNameOf(wrapper, control)
    expect(accessibleName, 'every interactive outreach control requires an accessible name').toBeTruthy()
    const tag = control.element.tagName
    const role = control.attributes('role')
    const type = control.attributes('type')?.toLowerCase()
    const triggersAction = tag === 'A'
      || tag === 'BUTTON'
      || (tag === 'INPUT' && ['button', 'submit', 'reset', 'image'].includes(type ?? ''))
      || ['button', 'link', 'menuitem'].includes(role ?? '')
    if (triggersAction) expect(accessibleName).not.toMatch(forbiddenAction)
  }

  const forbiddenState = /(?:^|\s)(?:contacted|sent|delivered|replied)(?:$|[\s,.:])/i
  for (const region of wrapper.findAll('[role="status"], [aria-live], output, [data-status]')) {
    const declaredStatus = region.attributes('data-status')?.replaceAll('_', ' ') ?? ''
    expect(`${accessibleNameOf(wrapper, region)} ${declaredStatus}`.trim()).not.toMatch(forbiddenState)
  }

  const forbiddenPurpose = /(?:^|[-_])(?:delivery|contacted|sent|delivered|replied|attachment|tracking)(?:[-_]|$)/i
  for (const control of wrapper.findAll('input, textarea, select, button')) {
    expect(`${control.attributes('name') ?? ''} ${control.attributes('id') ?? ''}`.trim()).not.toMatch(forbiddenPurpose)
  }
  expect(wrapper.find('input[type="file"]').exists()).toBe(false)

  for (const image of wrapper.findAll('img')) {
    const width = image.attributes('width')
    const height = image.attributes('height')
    if (width !== undefined) expect(Number(width)).toBeGreaterThan(1)
    if (height !== undefined) expect(Number(height)).toBeGreaterThan(1)
  }
  for (const link of wrapper.findAll('a[href], form[action]')) {
    const destination = link.attributes('href') ?? link.attributes('action') ?? ''
    expect(destination).not.toMatch(/^mailto:/i)
    expect(destination).not.toMatch(/https?:\/\/(?:[^/]*\.)?(?:smartlead|resend)\.[^/]+/i)
  }

  const allowedSuppressionControls = new Set([
    'suppression_target',
    'suppression_reason',
    'suppression_source',
    'suppression_confirm',
  ])
  for (const control of wrapper.findAll('input, textarea, select, [contenteditable="true"]')) {
    const name = control.attributes('name') ?? ''
    if (name.startsWith('suppression_')) expect(allowedSuppressionControls.has(name)).toBe(true)
  }

  const suppressionReason = wrapper.find('[name="suppression_reason"]')
  if (suppressionReason.exists()) {
    const requiredControls = [...allowedSuppressionControls]
      .map(name => ({ name, control: wrapper.find(`[name="${name}"]`) }))
    const missing = requiredControls.filter(({ control }) => !control.exists()).map(({ name }) => name)
    expect(missing, 'the suppression panel requires only its four named inputs').toEqual([])
    if (missing.length > 0) return
    const required = requiredControls.map(({ control }) => control.element)
    let region: Element | null = suppressionReason.element.parentElement
    while (
      region
      && (!['SECTION', 'FIELDSET', 'ARTICLE'].includes(region.tagName)
        || !required.every(control => region!.contains(control)))
    ) region = region.parentElement
    expect(region, 'suppression controls require one semantic inline panel').not.toBeNull()
    const editableNames = [...region!.querySelectorAll('input, textarea, select, [contenteditable="true"]')]
      .map(control => control.getAttribute('name'))
    expect(editableNames.every(name => name !== null && allowedSuppressionControls.has(name))).toBe(true)
    expect(new Set(editableNames)).toEqual(allowedSuppressionControls)
  }
}

function assertTrackedTaskSurfaces(): void {
  for (const mounted of trackedTaskWrappers) assertNoDeliverySurface(mounted)
}

function firebaseCallCounts(): FirebaseCallCounts {
  return {
    apps: testDoubles.firebaseApps.mock.calls.length,
    initialize: testDoubles.firebaseInitialize.mock.calls.length,
    auth: testDoubles.firebaseAuth.mock.calls.length,
    provider: testDoubles.firebaseProvider.mock.calls.length,
    stateChange: testDoubles.firebaseStateChange.mock.calls.length,
  }
}

function acceptFirebaseBootstrapDelta(before: FirebaseCallCounts): void {
  const after = firebaseCallCounts()
  const deltas = (Object.keys(after) as Array<keyof FirebaseCallCounts>)
    .map(key => after[key] - before[key])
  expect(
    deltas.every(delta => delta === 0) || deltas.every(delta => delta === 1),
    `Firebase calls must be zero or one exact plugin bootstrap; received ${deltas.join('/')}`,
  ).toBe(true)
  acceptedFirebaseCalls = after
}

async function mountNuxtComponent(component: Component, options: Record<string, unknown> = {}) {
  const firebaseBefore = firebaseCallCounts()
  const violationsBefore = testDoubles.ioViolations.length
  const mounted = await mountSuspended(component, options as never)
  expect(testDoubles.ioViolations.slice(violationsBefore), 'mount must not catch an I/O guard').toEqual([])
  acceptFirebaseBootstrapDelta(firebaseBefore)
  return mounted
}

async function mountTaskComponent(component: Component, options: Record<string, unknown> = {}) {
  const mounted = await mountNuxtComponent(component, options)
  trackedTaskWrappers.add(mounted)
  expect(mounted.attributes('data-missing'), 'Task 12 component must exist and mount').toBeUndefined()
  assertNoDeliverySurface(mounted)
  if ([ListPage, NewPage, DetailPage].includes(component)) politeAnnouncer(mounted)
  return mounted
}

function button(wrapper: VueWrapper, name: string): DOMWrapper<HTMLButtonElement> {
  const found = wrapper.findAll<HTMLButtonElement>('button').find(item => item.text().trim() === name)
  expect(found, `button named "${name}" must be rendered`).toBeDefined()
  return found!
}

function field<T extends Element = HTMLInputElement>(wrapper: VueWrapper, selector: string): DOMWrapper<T> {
  const found = wrapper.find<T>(selector)
  expect(found.exists(), `field "${selector}" must be rendered`).toBe(true)
  return found
}

function candidateCheckboxes(
  wrapper: VueWrapper,
  rows: readonly OutreachCandidateSummary[],
): DOMWrapper<HTMLInputElement>[] {
  const checkboxes = wrapper.findAll<HTMLInputElement>('input[type="checkbox"]')
  return rows.map((row) => {
    const escapedCompany = row.company_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const companyName = new RegExp(`(?:^|\\W)${escapedCompany}(?:$|\\W)`)
    const matches = checkboxes.filter(checkbox => companyName.test(accessibleNameOf(wrapper, checkbox)))
    expect(matches, `one accessible selection control is required for ${row.company_name}`).toHaveLength(1)
    return matches[0]!
  })
}

async function completeCandidateForm(wrapper: VueWrapper): Promise<void> {
  await field(wrapper, 'input[type="radio"][value="founder-signals"]').setValue(true)
  for (const [name, value] of Object.entries({
    company_name: 'Example Labs',
    product_name: 'Signal Desk',
    product_url: 'https://product.example.invalid',
    business_email: BUSINESS_EMAIL,
    source_url: 'https://evidence.example.invalid/release',
    source_context: 'Public launch announcement.',
  })) await field(wrapper, `[name="${name}"]`).setValue(value)
  await field(wrapper, '[name="source_attested"]').setValue(true)
}

function installDownloadSpies(options: { clickError?: Error } = {}) {
  const originalCreateElement = document.createElement.bind(document)
  const anchor = originalCreateElement('a')
  const click = vi.spyOn(anchor, 'click').mockImplementation(() => {
    if (options.clickError) throw options.clickError
  })
  const remove = vi.spyOn(anchor, 'remove')
  const appendChild = vi.spyOn(document.body, 'appendChild')
  const createElement = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, ...args: unknown[]) => {
    if (tagName.toLowerCase() === 'a') return anchor
    return originalCreateElement(tagName, ...(args as []))
  }) as typeof document.createElement)
  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:https://test.invalid/outreach-csv')
  const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

  return { anchor, click, remove, appendChild, createElement, createObjectURL, revokeObjectURL }
}

function setDetailRoute(publicId = PUBLIC_ID): void {
  testDoubles.route.params = { publicId }
  testDoubles.route.path = `/admin/outreach/${publicId}`
  testDoubles.route.fullPath = `/admin/outreach/${publicId}`
}

function rejectUnexpectedIo(operation: string): never {
  testDoubles.ioViolations.push(operation)
  throw new Error(`Unexpected ${operation}`)
}

function providerGuard(provider: string): object {
  return new Proxy(function ProviderGuard() {}, {
    apply: () => rejectUnexpectedIo(`${provider} call`),
    construct: () => rejectUnexpectedIo(`${provider} construction`),
    get: (_target, property) => rejectUnexpectedIo(`${provider}.${String(property)}`),
  })
}

function requestHost(input: unknown): string {
  try { return new URL(String(input), 'https://test.invalid').host }
  catch { return 'invalid-host' }
}

function installIoGuards(): void {
  vi.stubGlobal('fetch', vi.fn((input: unknown) => {
    return rejectUnexpectedIo(`fetch to ${requestHost(input)}`)
  }))
  vi.stubGlobal('$fetch', vi.fn((input: unknown) => rejectUnexpectedIo(`$fetch to ${requestHost(input)}`)))
  vi.stubGlobal('XMLHttpRequest', vi.fn(function UnexpectedXmlHttpRequest() { return rejectUnexpectedIo('XMLHttpRequest') }))
  vi.stubGlobal('WebSocket', vi.fn(function UnexpectedWebSocket() { return rejectUnexpectedIo('WebSocket') }))
  vi.stubGlobal('EventSource', vi.fn(function UnexpectedEventSource() { return rejectUnexpectedIo('EventSource') }))
  vi.stubGlobal('indexedDB', {
    open: vi.fn(() => rejectUnexpectedIo('IndexedDB open')),
    deleteDatabase: vi.fn(() => rejectUnexpectedIo('IndexedDB deleteDatabase')),
    databases: vi.fn(() => rejectUnexpectedIo('IndexedDB databases')),
  })
  vi.stubGlobal('Resend', providerGuard('Resend'))
  vi.stubGlobal('Smartlead', providerGuard('Smartlead'))
  originalSendBeaconDescriptor = Object.getOwnPropertyDescriptor(navigator, 'sendBeacon')
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: vi.fn(() => rejectUnexpectedIo('navigator.sendBeacon')),
  })
  const guardedStorage = {
    getItem: vi.fn(() => rejectUnexpectedIo('storage read')),
    setItem: vi.fn(() => rejectUnexpectedIo('storage write')),
    removeItem: vi.fn(() => rejectUnexpectedIo('storage delete')),
    clear: vi.fn(() => rejectUnexpectedIo('storage clear')),
    key: vi.fn(() => rejectUnexpectedIo('storage key read')),
    length: 0,
  }
  vi.stubGlobal('localStorage', guardedStorage)
  vi.stubGlobal('sessionStorage', guardedStorage)
}

function resetDocumentHead(): void {
  document.title = ''
  for (const meta of document.head.querySelectorAll('meta[name="robots"]')) meta.remove()
}

beforeEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  trackedTaskWrappers.clear()
  testDoubles.ioViolations.length = 0
  acceptedFirebaseCalls = firebaseCallCounts()
  resetDocumentHead()
  testDoubles.route = reactive({
    path: '/admin/outreach',
    fullPath: '/admin/outreach',
    params: {},
    query: {},
  })
  testDoubles.routerReplace.mockResolvedValue(undefined)
  testDoubles.navigateTo.mockResolvedValue(undefined)
  testDoubles.validateCommittedRecovery.mockImplementation((value: unknown) => {
    if (typeof value === 'object' && value !== null && 'public_id' in value && typeof value.public_id === 'string') return value.public_id
    throw new OutreachApiError('server')
  })
  testDoubles.useAdminOutreach.mockReturnValue(api())
  testDoubles.useOutreachCandidatePage.mockReturnValue(controller())
  testDoubles.useAuth.mockReturnValue({
    user: ref({ uid: 'admin', email: null, displayName: 'Admin' }),
    isAdmin: vi.fn().mockResolvedValue(true),
    logout: vi.fn().mockResolvedValue(undefined),
    waitForAuthReady: vi.fn().mockResolvedValue(undefined),
  })
  testDoubles.useAdminListings.mockReturnValue(dashboardApi())
  installIoGuards()
  vi.spyOn(Date, 'now').mockReturnValue(NOW)
})

afterEach(() => {
  try {
    expect(testDoubles.ioViolations, 'caught or uncaught external I/O is forbidden').toEqual([])
    expect(firebaseCallCounts(), 'Firebase calls after the accepted plugin bootstrap are forbidden')
      .toEqual(acceptedFirebaseCalls)
    expect(testDoubles.firebaseForbidden).not.toHaveBeenCalled()
    assertTrackedTaskSurfaces()
  } finally {
    vi.useRealTimers()
    if (originalSendBeaconDescriptor) Object.defineProperty(navigator, 'sendBeacon', originalSendBeaconDescriptor)
    else Reflect.deleteProperty(navigator, 'sendBeacon')
    originalSendBeaconDescriptor = undefined
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    trackedTaskWrappers.clear()
    document.body.innerHTML = ''
    resetDocumentHead()
  }
})

describe('admin outreach list', () => {
  test('renders independent loading, retryable error, empty, and successful masked-row states', async () => {
    const pending = new Promise<OutreachCandidatePage>(() => {})
    const loadingApi = api({ listCandidates: vi.fn(() => pending) })
    testDoubles.useAdminOutreach.mockReturnValue(loadingApi)
    const loading = await mountTaskComponent(ListPage)
    expect(loading.text()).toContain('Loading outreach candidates')
    loading.unmount()

    const retryApi = api({
      listCandidates: vi.fn()
        .mockRejectedValueOnce(new OutreachApiError('network'))
        .mockResolvedValueOnce(page()),
    })
    testDoubles.useAdminOutreach.mockReturnValue(retryApi)
    const failed = await mountTaskComponent(ListPage)
    await settle()
    expect(failed.find('[role="alert"]').text()).toContain('Could not reach LaunchLog')
    expect(button(failed, 'Retry')).toBeTruthy()
    await button(failed, 'Retry')!.trigger('click')
    await settle()
    expect(retryApi.listCandidates).toHaveBeenCalledTimes(2)
    failed.unmount()

    testDoubles.useAdminOutreach.mockReturnValue(api({ listCandidates: vi.fn().mockResolvedValue(page()) }))
    const empty = await mountTaskComponent(ListPage)
    await settle()
    expect(empty.text()).toContain('No candidates match these filters')
    empty.unmount()

    const row = summary()
    testDoubles.useAdminOutreach.mockReturnValue(api({ listCandidates: vi.fn().mockResolvedValue(page([row])) }))
    const success = await mountTaskComponent(ListPage)
    await settle()
    expect(success.text()).toContain(row.business_email_masked)
    expect(success.text()).toContain(row.normalized_domain)
    expect(success.text()).toContain('Revision 7')
    expect(success.find(`a[href="/admin/outreach/${PUBLIC_ID}"]`).exists()).toBe(true)
    expect(success.text()).not.toContain(BUSINESS_EMAIL)
    expect(success.text()).not.toContain('Public product launch announcement.')
  })

  test.each([
    [{ status: 'failed' }, { status: 'failed' }],
    [{ campaign_key: 'founder-signals' }, { campaign_key: 'founder-signals' }],
    [{ domain: ' Product.Example.Invalid. ' }, { domain: 'product.example.invalid' }],
    [{ suppressed: '0' }, { suppressed: false }],
    [{ suppressed: '1' }, { suppressed: true }],
    [{ page: '2' }, { page: 2 }],
    [{ status: 'approved', suppressed: '0', page: '3' }, { status: 'approved', suppressed: false, page: 3 }],
  ])('parses canonical URL query %j into typed API filters', async (query, expected) => {
    testDoubles.route.query = query
    const client = api()
    testDoubles.useAdminOutreach.mockReturnValue(client)

    const mounted = await mountTaskComponent(ListPage)
    await settle()

    expect(client.listCandidates).toHaveBeenCalledTimes(1)
    expect(client.listCandidates).toHaveBeenCalledWith(expected, expect.anything())
    mounted.unmount()
  })

  test.each([
    { suppressed: 'true' },
    { suppressed: '2' },
    { page: '01' },
    { page: '0' },
    { page: '-1' },
    { page: '2.5' },
    { status: 'contacted' },
  ])('drops malformed route state before the API boundary: %j', async (query) => {
    testDoubles.route.query = query
    const client = api()
    testDoubles.useAdminOutreach.mockReturnValue(client)

    const mounted = await mountTaskComponent(ListPage)
    await settle()

    expect(client.listCandidates).toHaveBeenCalledOnce()
    expect(client.listCandidates).toHaveBeenCalledWith({}, expect.anything())
    expect(testDoubles.routerReplace).toHaveBeenCalledWith({ query: {} })
    mounted.unmount()
  })

  test('serializes suppression and page filters canonically without private data', async () => {
    const client = api()
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()

    await button(mounted, 'Not suppressed')!.trigger('click')
    await settle()
    expect(testDoubles.routerReplace).toHaveBeenLastCalledWith({ query: { suppressed: '0' } })

    await button(mounted, 'Suppressed only')!.trigger('click')
    await settle()
    expect(testDoubles.routerReplace).toHaveBeenLastCalledWith({ query: { suppressed: '1' } })

    await button(mounted, 'All suppressions')!.trigger('click')
    await settle()
    expect(testDoubles.routerReplace).toHaveBeenLastCalledWith({ query: {} })
    expect(JSON.stringify(testDoubles.routerReplace.mock.calls)).not.toContain(BUSINESS_EMAIL)
  })

  test('renders exact status/campaign chips and serializes domain and page controls canonically', async () => {
    const result = page([summary()])
    result.links.next = '/api/v1/admin/outreach/candidates?page=2'
    result.meta.last_page = 2
    result.meta.total = 31
    const client = api({
      listCampaigns: vi.fn().mockResolvedValue([campaign(), campaign({ key: 'second-campaign', name: 'Second campaign' })]),
      listCandidates: vi.fn().mockResolvedValue(result),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()

    const statusValues = ['', 'draft', 'preview_generating', 'ready_for_review', 'approved', 'exported', 'failed', 'expired', 'suppressed', 'converted']
    expect(mounted.findAll('button[data-status]').map(item => item.attributes('data-status'))).toEqual(statusValues)
    for (const chip of mounted.findAll('button[data-status], button[data-campaign-filter]')) {
      expect(['true', 'false']).toContain(chip.attributes('aria-pressed'))
    }

    await button(mounted, 'Failed preview').trigger('click')
    expect(testDoubles.routerReplace).toHaveBeenLastCalledWith({ query: { status: 'failed' } })
    await mounted.find('button[data-campaign-filter="second-campaign"]').trigger('click')
    expect(testDoubles.routerReplace).toHaveBeenLastCalledWith({ query: { campaign_key: 'second-campaign' } })
    await field(mounted, '[name="domain"]').setValue(' Product.Example.Invalid. ')
    await button(mounted, 'Apply domain').trigger('click')
    expect(testDoubles.routerReplace).toHaveBeenLastCalledWith({ query: { domain: 'product.example.invalid' } })
    await button(mounted, 'Next page').trigger('click')
    expect(testDoubles.routerReplace).toHaveBeenLastCalledWith({ query: { page: '2' } })
    expect(JSON.stringify(testDoubles.routerReplace.mock.calls)).not.toContain(BUSINESS_EMAIL)
  })

  test('preserves canonical filters across interactions and resets page only when a filter changes', async () => {
    testDoubles.route.query = {
      status: 'approved',
      campaign_key: 'founder-signals',
      domain: 'product.example.invalid',
      suppressed: '0',
      page: '3',
    }
    const result = page([summary()])
    result.links.next = '/api/v1/admin/outreach/candidates?page=2'
    result.meta.last_page = 2
    const client = api({
      listCampaigns: vi.fn().mockResolvedValue([
        campaign(),
        campaign({ key: 'second-campaign', name: 'Second campaign' }),
      ]),
      listCandidates: vi.fn().mockResolvedValue(result),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()

    await button(mounted, 'Failed preview').trigger('click')
    const afterStatus = {
      status: 'failed', campaign_key: 'founder-signals', domain: 'product.example.invalid', suppressed: '0',
    }
    expect(testDoubles.routerReplace).toHaveBeenLastCalledWith({ query: afterStatus })
    testDoubles.route.query = afterStatus
    await settle()

    await mounted.find('button[data-campaign-filter="second-campaign"]').trigger('click')
    const afterCampaign = {
      status: 'failed', campaign_key: 'second-campaign', domain: 'product.example.invalid', suppressed: '0',
    }
    expect(testDoubles.routerReplace).toHaveBeenLastCalledWith({ query: afterCampaign })
    testDoubles.route.query = afterCampaign
    await settle()

    await field(mounted, '[name="domain"]').setValue(' Replacement.Example.Invalid. ')
    await button(mounted, 'Apply domain').trigger('click')
    const afterDomain = {
      status: 'failed', campaign_key: 'second-campaign', domain: 'replacement.example.invalid', suppressed: '0',
    }
    expect(testDoubles.routerReplace).toHaveBeenLastCalledWith({ query: afterDomain })
    testDoubles.route.query = afterDomain
    await settle()

    await button(mounted, 'Next page').trigger('click')
    expect(testDoubles.routerReplace).toHaveBeenLastCalledWith({ query: { ...afterDomain, page: '2' } })
  })

  test('aborts and ignores a late list result after the canonical route-query epoch changes', async () => {
    testDoubles.route.query = { status: 'approved' }
    const first = deferred<OutreachCandidatePage>()
    const second = deferred<OutreachCandidatePage>()
    const listCandidates = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const client = api({ listCandidates })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await nextTick()
    expect(listCandidates).toHaveBeenCalledOnce()

    testDoubles.route.query = { status: 'failed' }
    await nextTick()
    expect(listCandidates).toHaveBeenCalledTimes(2)
    const firstSignal = listCandidates.mock.calls[0]![1]?.signal as AbortSignal
    const secondSignal = listCandidates.mock.calls[1]![1]?.signal as AbortSignal
    expect(firstSignal.aborted).toBe(true)
    expect(secondSignal.aborted).toBe(false)

    second.resolve(page([summary({ company_name: 'Current epoch company' })]))
    await settle()
    expect(mounted.text()).toContain('Current epoch company')

    first.resolve(page([summary({ company_name: 'Late stale company' })]))
    await settle()
    expect(mounted.text()).toContain('Current epoch company')
    expect(mounted.text()).not.toContain('Late stale company')
  })

  test('drops hidden selection when the mandatory click-exception reload returns a new result identity', async () => {
    const firstResult = page([summary({
      company_name: 'First result identity',
      persisted_status: 'exported',
      effective_status: 'exported',
      export_count: 1,
    })])
    const secondResult = page([summary({
      public_id: OTHER_PUBLIC_ID,
      company_name: 'Second result identity',
      persisted_status: 'exported',
      effective_status: 'exported',
      export_count: 1,
    })])
    const listCandidates = vi.fn()
      .mockResolvedValueOnce(firstResult)
      .mockResolvedValueOnce(secondResult)
    const client = api({ listCandidates })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()
    await candidateCheckboxes(mounted, firstResult.data)[0]!.setValue(true)
    const reexportConfirmation = field(mounted, '[name="confirm_reexport"]')
    await reexportConfirmation.setValue(true)
    expect(reexportConfirmation.element.checked).toBe(true)
    expect(mounted.text()).toContain('1 selected')
    const dom = installDownloadSpies({ clickError: new Error('Browser blocked download') })

    await button(mounted, 'Download CSV').trigger('click')
    await settle()

    expect(listCandidates).toHaveBeenCalledTimes(2)
    expect(listCandidates).toHaveBeenNthCalledWith(1, {}, expect.anything())
    expect(listCandidates).toHaveBeenNthCalledWith(2, {}, expect.anything())
    expect(client.exportCandidates).toHaveBeenCalledWith({
      campaign_key: 'founder-signals',
      prospect_public_ids: [PUBLIC_ID],
      confirm_reexport: true,
    }, expect.anything())
    expect(mounted.text()).toContain('Second result identity')
    expect(mounted.text()).not.toContain('First result identity')
    expect(mounted.text()).not.toContain('1 selected')
    expect(mounted.find('[name="confirm_reexport"]').exists()).toBe(false)
    expect(candidateCheckboxes(mounted, secondResult.data)[0]!.element.checked).toBe(false)
    expect(dom.click).toHaveBeenCalledOnce()
    expect(dom.remove).toHaveBeenCalledOnce()
    expect(dom.revokeObjectURL).toHaveBeenCalledOnce()
  })

  test('requires distinct inline activation and terminal archive confirmations', async () => {
    const client = api({
      listCampaigns: vi.fn().mockResolvedValue([
        campaign({ status: 'draft' }),
        campaign({ key: 'active-campaign', name: 'Active campaign' }),
        campaign({ key: 'archived-campaign', name: 'Archived campaign', status: 'archived' }),
      ]),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()

    expect(button(mounted, 'Enable CSV export in LaunchLog')).toBeTruthy()
    expect(button(mounted, 'Archive campaign')).toBeTruthy()
    expect(mounted.text()).not.toContain('activate Smartlead')

    await button(mounted, 'Enable CSV export in LaunchLog')!.trigger('click')
    expect(client.updateCampaign).not.toHaveBeenCalled()
    expect(mounted.text()).toContain('This enables LaunchLog CSV export only')
    await button(mounted, 'Confirm CSV eligibility')!.trigger('click')
    await settle()
    expect(client.updateCampaign).toHaveBeenCalledWith('founder-signals', { status: 'active' }, expect.anything())

    await button(mounted, 'Archive campaign')!.trigger('click')
    expect(client.updateCampaign).toHaveBeenCalledTimes(1)
    await button(mounted, 'Confirm permanent archive')!.trigger('click')
    await settle()
    expect(client.updateCampaign).toHaveBeenCalledWith('founder-signals', { status: 'archived' }, expect.anything())
  })

  test('creates an internal campaign with the exact payload, pending lock, safe error, and retained rows', async () => {
    const createResult = deferred<OutreachCampaign>()
    const client = api({
      listCandidates: vi.fn().mockResolvedValue(page([summary()])),
      createCampaign: vi.fn(() => createResult.promise),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()

    await field(mounted, '[name="campaign_name"]').setValue('  Autumn founders  ')
    await field(mounted, '[name="campaign_key"]').setValue('autumn-founders')
    await field(mounted, '[name="sender_identity_label"]').setValue('  Founder research  ')
    await button(mounted, 'Create campaign').trigger('click')
    await nextTick()

    expect(client.createCampaign).toHaveBeenCalledWith({
      name: 'Autumn founders',
      key: 'autumn-founders',
      sender_identity_label: 'Founder research',
    }, expect.anything())
    expect(button(mounted, 'Creating campaign…').attributes('disabled')).toBeDefined()
    expect(mounted.text()).toContain('o***r@example.invalid')

    createResult.reject(new OutreachApiError('server'))
    await settle()
    expect(mounted.find('[role="alert"]').text()).toContain('LaunchLog could not complete this request')
    expect(mounted.text()).toContain('o***r@example.invalid')
    expect(client.createCampaign).toHaveBeenCalledOnce()
  })

  test('renders archived campaigns as terminal and disables duplicate lifecycle actions while pending', async () => {
    const updateResult = deferred<OutreachCampaign>()
    const client = api({
      listCampaigns: vi.fn().mockResolvedValue([
        campaign({ status: 'draft' }),
        campaign({ key: 'archived-campaign', name: 'Archived campaign', status: 'archived' }),
      ]),
      updateCampaign: vi.fn(() => updateResult.promise),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()

    const archived = mounted.find('[data-campaign-key="archived-campaign"]')
    expect(archived.text()).toContain('Archived')
    expect(archived.findAll('button')).toHaveLength(0)

    await button(mounted, 'Enable CSV export in LaunchLog').trigger('click')
    await button(mounted, 'Confirm CSV eligibility').trigger('click')
    await nextTick()
    expect(button(mounted, 'Enabling CSV export…').attributes('disabled')).toBeDefined()
    expect(button(mounted, 'Archive campaign').attributes('disabled')).toBeDefined()
    await button(mounted, 'Archive campaign').trigger('click')
    expect(client.updateCampaign).toHaveBeenCalledOnce()
    updateResult.resolve(campaign())
  })

  test('enforces the exact summary eligibility predicate', async () => {
    const rows = [
      summary({ public_id: publicIdAt(0), company_name: 'Eligible approved' }),
      summary({ public_id: publicIdAt(1), company_name: 'Eligible exported', persisted_status: 'exported', effective_status: 'exported', export_count: 1 }),
      summary({ public_id: publicIdAt(2), company_name: 'Inactive', campaign_status: 'draft' }),
      summary({ public_id: publicIdAt(3), company_name: 'Persisted draft', persisted_status: 'draft' }),
      summary({ public_id: publicIdAt(4), company_name: 'Review only', effective_status: 'ready_for_review' }),
      summary({ public_id: publicIdAt(5), company_name: 'Suppressed', effective_status: 'suppressed' }),
      summary({ public_id: publicIdAt(6), company_name: 'Missing approval', approved_at: null }),
      summary({ public_id: publicIdAt(7), company_name: 'Generating', preview_status: 'generating' }),
      summary({ public_id: publicIdAt(8), company_name: 'Invalid expiry', expires_at: 'not-an-instant' }),
      summary({ public_id: publicIdAt(9), company_name: 'Too short', expires_at: new Date(NOW + DAY - 1).toISOString() }),
      summary({ public_id: publicIdAt(10), company_name: 'Exact boundary', expires_at: new Date(NOW + DAY).toISOString() }),
    ]
    testDoubles.useAdminOutreach.mockReturnValue(api({ listCandidates: vi.fn().mockResolvedValue(page(rows)) }))
    const mounted = await mountTaskComponent(ListPage)
    await settle()

    const checkboxes = candidateCheckboxes(mounted, rows)
    expect(checkboxes).toHaveLength(rows.length)
    for (const [index, checkbox] of checkboxes.entries()) {
      const row = rows[index]!
      expect(accessibleNameOf(mounted, checkbox)).toContain(row.company_name)
      expect(accessibleNameOf(mounted, checkbox)).not.toContain(BUSINESS_EMAIL)
      const semanticRows = mounted.findAll(`a[href="/admin/outreach/${row.public_id}"]`)
        .map(link => link.element.closest('tr, [role="row"], article, li'))
        .filter((element): element is Element => element !== null)
        .filter(element => element.textContent?.includes(row.company_name))
      expect(semanticRows.length, `one semantic row/card is required for ${row.company_name}`).toBeGreaterThan(0)
      expect(semanticRows[0]!.textContent).toContain(row.product_name)
    }
    for (const index of [0, 1, 10]) expect(checkboxes[index]!.attributes('disabled')).toBeUndefined()
    for (const index of [2, 3, 4, 5, 6, 7, 8, 9]) expect(checkboxes[index]!.attributes('disabled')).toBeDefined()
  })

  test('accepts 30 same-campaign rows, refuses the true 31st, and refuses a mixed campaign', async () => {
    const rows = Array.from({ length: 32 }, (_, index) => summary({
      public_id: publicIdAt(index),
      company_name: `Example ${index + 1}`,
      campaign_key: index === 31 ? 'other-campaign' : 'founder-signals',
    }))
    const client = api({ listCandidates: vi.fn().mockResolvedValue(page(rows)) })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()

    const selectable = candidateCheckboxes(mounted, rows)
    expect(selectable).toHaveLength(32)
    await selectable[0]!.setValue(true)
    expect(selectable[31]!.attributes('disabled')).toBeDefined()
    expect(selectable[30]!.attributes('disabled')).toBeUndefined()
    for (const checkbox of selectable.slice(1, 30)) await checkbox.setValue(true)
    expect(selectable[30]!.attributes('disabled')).toBeDefined()
    expect(selectable[31]!.attributes('disabled')).toBeDefined()
    expect(mounted.text()).toContain('30 selected')

    await button(mounted, 'Failed preview')!.trigger('click')
    await settle()
    expect(mounted.text()).not.toContain('30 selected')
  })

  test.each([
    ['status', 'failed'],
    ['campaign_key', 'another-campaign'],
    ['domain', 'other.example.invalid'],
    ['suppressed', '1'],
    ['page', '2'],
  ])('clears selection and re-export confirmation when %s changes', async (queryKey, queryValue) => {
    const exported = summary({ export_count: 1, persisted_status: 'exported', effective_status: 'exported' })
    const client = api({ listCandidates: vi.fn().mockResolvedValue(page([exported])) })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()
    await candidateCheckboxes(mounted, [exported])[0]!.setValue(true)
    await field(mounted, '[name="confirm_reexport"]').setValue(true)

    ;(testDoubles.route.query as Record<string, string>)[queryKey] = queryValue
    await settle()

    expect(client.listCandidates).toHaveBeenCalledTimes(2)
    expect(mounted.text()).not.toContain('1 selected')
    expect(mounted.find('[name="confirm_reexport"]').exists()).toBe(false)
  })

  test('downloads an ordinary CSV once, cleans DOM/object URL once, and performs one authoritative reload', async () => {
    const blob = new Blob(['safe'], { type: 'text/csv' })
    const client = api({
      listCandidates: vi.fn()
        .mockResolvedValueOnce(page([summary()]))
        .mockResolvedValueOnce(page([summary({ export_count: 1, persisted_status: 'exported', effective_status: 'exported' })])),
      exportCandidates: vi.fn().mockResolvedValue({ blob, filename: 'launchlog-outreach-founder-signals.csv' }),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()
    await candidateCheckboxes(mounted, [summary()])[0]!.setValue(true)
    const dom = installDownloadSpies()

    await button(mounted, 'Download CSV').trigger('click')
    await settle()

    expect(client.exportCandidates).toHaveBeenCalledWith({
      campaign_key: 'founder-signals',
      prospect_public_ids: [PUBLIC_ID],
      confirm_reexport: false,
    }, expect.anything())
    expect(dom.createObjectURL).toHaveBeenCalledOnce()
    expect(dom.createObjectURL).toHaveBeenCalledWith(blob)
    expect(dom.appendChild.mock.calls.filter(([node]) => node === dom.anchor)).toHaveLength(1)
    expect(dom.click).toHaveBeenCalledOnce()
    expect(dom.remove).toHaveBeenCalledOnce()
    expect(dom.revokeObjectURL).toHaveBeenCalledOnce()
    expect(mounted.find('[name="confirm_reexport"]').exists()).toBe(false)
    expect(dom.revokeObjectURL).toHaveBeenCalledWith('blob:https://test.invalid/outreach-csv')
    expect(dom.anchor.href).toBe('blob:https://test.invalid/outreach-csv')
    expect(dom.anchor.download).toBe('launchlog-outreach-founder-signals.csv')
    expect(dom.anchor.getAttributeNames().sort()).toEqual(['download', 'href'])
    expect(client.listCandidates).toHaveBeenCalledTimes(2)
    expect(mounted.text()).not.toContain('1 selected')
  })

  test('requires mixed-row re-export confirmation and keeps exact-once cleanup', async () => {
    const blob = new Blob(['safe'], { type: 'text/csv' })
    const rows = [summary(), summary({
      public_id: OTHER_PUBLIC_ID,
      company_name: 'Previously exported',
      persisted_status: 'exported',
      effective_status: 'exported',
      export_count: 2,
    })]
    const client = api({
      listCandidates: vi.fn().mockResolvedValue(page(rows)),
      exportCandidates: vi.fn().mockResolvedValue({ blob, filename: 'launchlog-outreach-founder-signals.csv' }),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()
    for (const checkbox of candidateCheckboxes(mounted, rows)) await checkbox.setValue(true)

    expect(mounted.text()).toContain('Some selected candidates were exported before')
    await button(mounted, 'Download CSV').trigger('click')
    expect(client.exportCandidates).not.toHaveBeenCalled()
    await field(mounted, '[name="confirm_reexport"]').setValue(true)
    const dom = installDownloadSpies()
    await button(mounted, 'Download CSV').trigger('click')
    await settle()

    expect(client.exportCandidates).toHaveBeenCalledWith({
      campaign_key: 'founder-signals',
      prospect_public_ids: [PUBLIC_ID, OTHER_PUBLIC_ID],
      confirm_reexport: true,
    }, expect.anything())
    expect(dom.click).toHaveBeenCalledOnce()
    expect(dom.remove).toHaveBeenCalledOnce()
    expect(dom.revokeObjectURL).toHaveBeenCalledOnce()
    expect(mounted.text()).not.toContain('2 selected')
    expect(mounted.find('[name="confirm_reexport"]').exists()).toBe(false)
  })

  test('cleans up and performs one audit reload when the browser click throws', async () => {
    const client = api({ listCandidates: vi.fn().mockResolvedValue(page([summary()])) })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()
    await candidateCheckboxes(mounted, [summary()])[0]!.setValue(true)
    const dom = installDownloadSpies({ clickError: new Error('Browser blocked download') })

    await button(mounted, 'Download CSV').trigger('click')
    await settle()

    expect(dom.click).toHaveBeenCalledOnce()
    expect(dom.remove).toHaveBeenCalledOnce()
    expect(dom.revokeObjectURL).toHaveBeenCalledOnce()
    expect(client.listCandidates).toHaveBeenCalledTimes(2)
    expect(mounted.find('[role="alert"]').text()).toContain('browser did not complete the download')
    expect(mounted.text()).toContain('1 selected')
  })

  test('retains a completed download and rows when the one post-download reload fails', async () => {
    const client = api({
      listCandidates: vi.fn()
        .mockResolvedValueOnce(page([summary()]))
        .mockRejectedValueOnce(new OutreachApiError('network')),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()
    await candidateCheckboxes(mounted, [summary()])[0]!.setValue(true)
    const dom = installDownloadSpies()

    await button(mounted, 'Download CSV').trigger('click')
    await settle()

    expect(dom.click).toHaveBeenCalledOnce()
    expect(dom.remove).toHaveBeenCalledOnce()
    expect(dom.revokeObjectURL).toHaveBeenCalledOnce()
    expect(client.exportCandidates).toHaveBeenCalledOnce()
    expect(client.listCandidates).toHaveBeenCalledTimes(2)
    expect(mounted.text()).toContain('Example Labs')
    expect(mounted.text()).toContain('Download completed')
    expect(mounted.text()).toContain('Refresh required')
  })

  test.each(['network', 'server'] as const)('creates no browser artifact and latches refresh after an uncertain %s export failure', async (kind) => {
    const client = api({
      listCandidates: vi.fn().mockResolvedValue(page([summary()])),
      exportCandidates: vi.fn().mockRejectedValue(new OutreachApiError(kind)),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()
    await candidateCheckboxes(mounted, [summary()])[0]!.setValue(true)
    const dom = installDownloadSpies()

    await button(mounted, 'Download CSV').trigger('click')
    await settle()

    expect(client.exportCandidates).toHaveBeenCalledOnce()
    expect(client.listCandidates).toHaveBeenCalledOnce()
    expect(dom.createObjectURL).not.toHaveBeenCalled()
    expect(dom.click).not.toHaveBeenCalled()
    expect(dom.remove).not.toHaveBeenCalled()
    expect(dom.revokeObjectURL).not.toHaveBeenCalled()
    expect(mounted.text()).toContain('Refresh required')
    expect(button(mounted, 'Download CSV').attributes('disabled')).toBeDefined()
  })

  test('drops a late export result after unmount without a download, reload, or state write', async () => {
    const exportResult = deferred<{ blob: Blob, filename: string }>()
    const client = api({
      listCandidates: vi.fn().mockResolvedValue(page([summary()])),
      exportCandidates: vi.fn(() => exportResult.promise),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()
    await candidateCheckboxes(mounted, [summary()])[0]!.setValue(true)
    const dom = installDownloadSpies()
    await button(mounted, 'Download CSV').trigger('click')
    await nextTick()
    expect(button(mounted, 'Downloading CSV…').attributes('disabled')).toBeDefined()

    mounted.unmount()
    exportResult.resolve({ blob: new Blob(['safe']), filename: 'launchlog-outreach.csv' })
    await settle()

    expect(dom.createObjectURL).not.toHaveBeenCalled()
    expect(dom.click).not.toHaveBeenCalled()
    expect(dom.remove).not.toHaveBeenCalled()
    expect(dom.revokeObjectURL).not.toHaveBeenCalled()
    expect(client.listCandidates).toHaveBeenCalledOnce()
  })
})

describe('candidate creation', () => {
  test('renders campaign loading, safe retryable error, empty, and recovered states independently', async () => {
    const pending = deferred<OutreachCampaign[]>()
    testDoubles.useAdminOutreach.mockReturnValue(api({ listCampaigns: vi.fn(() => pending.promise) }))
    const loading = await mountTaskComponent(NewPage)
    expect(loading.text()).toContain('Loading outreach campaigns')
    expect(loading.find('form').exists()).toBe(false)
    loading.unmount()

    const client = api({
      listCampaigns: vi.fn()
        .mockRejectedValueOnce(new OutreachApiError('network'))
        .mockResolvedValueOnce([]),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const failed = await mountTaskComponent(NewPage)
    await settle()
    expect(failed.find('[role="alert"]').text()).toContain('Could not reach LaunchLog')
    await button(failed, 'Retry').trigger('click')
    await settle()
    expect(client.listCampaigns).toHaveBeenCalledTimes(2)
    expect(failed.text()).toContain('Create a non-archived campaign first')
    expect(failed.find('form').exists()).toBe(false)
  })

  test('renders branded non-archived campaign radios and the complete accessible candidate form', async () => {
    const client = api({
      listCampaigns: vi.fn().mockResolvedValue([
        campaign({ status: 'draft' }),
        campaign({ key: 'archived-campaign', name: 'Archived campaign', status: 'archived' }),
      ]),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(NewPage)
    await settle()

    const activeCampaign = field(mounted, 'input[type="radio"][value="founder-signals"]')
    const campaignGroup = activeCampaign.element.closest('fieldset')
    expect(campaignGroup).not.toBeNull()
    expect(campaignGroup!.querySelector(':scope > legend')?.textContent?.trim()).toBeTruthy()
    expect(accessibleNameOf(mounted, activeCampaign)).toContain('Founder signals')
    const archivedCampaign = field(mounted, 'input[type="radio"][value="archived-campaign"]')
    expect(accessibleNameOf(mounted, archivedCampaign)).toContain('Archived campaign')
    expect(archivedCampaign.attributes('disabled')).toBeDefined()
    for (const [name, label] of [
      ['company_name', 'Company name'],
      ['product_name', 'Product name'],
      ['product_url', 'Product URL'],
      ['founder_first_name', 'Founder first name'],
      ['business_email', 'Business email'],
      ['country_code', 'Country'],
      ['source_url', 'Public source URL'],
      ['source_context', 'Public source context'],
      ['notes', 'Notes'],
    ] as const) {
      expect(mounted.find(`label[for="${name}"]`).text()).toContain(label)
      const input = field(mounted, `#${name}[name="${name}"]`)
      expect(input.attributes('aria-describedby')?.split(' ')).toEqual(expect.arrayContaining([
        `${name}-description`,
        `${name}-error`,
      ]))
      expect(input.attributes('aria-invalid')).toBe('false')
      expect(mounted.find(`#${name}-description`).exists()).toBe(true)
    }
    expect(mounted.find('label[for="source_attested"]').text()).toContain('I confirm this evidence is public')
    expect(field(mounted, '#source_attested[name="source_attested"]').attributes('aria-describedby')).toContain('source_attested-description')
    expect(mounted.text()).toContain('I confirm this evidence is public')
  })

  test('form emits only normalized allowlisted fields and keeps values after client validation', async () => {
    const mounted = await mountTaskComponent(CandidateForm, {
      props: { campaignKey: 'founder-signals', submitting: false, backendErrors: {} },
    })

    const values: Record<string, string> = {
      company_name: '  Example Labs  ',
      product_name: '  Signal Desk  ',
      product_url: 'https://product.example.invalid',
      founder_first_name: '  Avery  ',
      business_email: `  ${BUSINESS_EMAIL.toUpperCase()}  `,
      country_code: ' us ',
      source_url: 'https://evidence.example.invalid/release',
      source_context: '  Public launch announcement.  ',
      notes: '  Review the public release.  ',
    }
    for (const [name, value] of Object.entries(values)) {
      await mounted.find(`[name="${name}"]`).setValue(value)
    }
    await mounted.find('[name="source_attested"]').setValue(true)
    await mounted.find('form').trigger('submit')
    await settle()

    expect(mounted.emitted('submit')?.[0]?.[0]).toEqual({
      campaign_key: 'founder-signals',
      company_name: 'Example Labs',
      product_name: 'Signal Desk',
      product_url: 'https://product.example.invalid',
      founder_first_name: 'Avery',
      business_email: BUSINESS_EMAIL,
      country_code: 'US',
      source_url: 'https://evidence.example.invalid/release',
      source_context: 'Public launch announcement.',
      notes: 'Review the public release.',
      source_attested: true,
    })
    expect(mounted.attributes('data-private-storage')).toBeUndefined()
  })

  test('renders client validation beside fields, preserves values, and emits no invalid payload', async () => {
    const mounted = await mountTaskComponent(CandidateForm, {
      props: { campaignKey: 'founder-signals', submitting: false, backendErrors: {} },
    })
    await field(mounted, '[name="company_name"]').setValue('Remember me')
    await field(mounted, '[name="business_email"]').setValue('not-an-email')
    await field(mounted, '[name="product_url"]').setValue('javascript:alert(1)')
    await field(mounted, 'form').trigger('submit')
    await settle()

    expect(mounted.emitted('submit')).toBeUndefined()
    expect(field(mounted, '[name="company_name"]').element.value).toBe('Remember me')
    expect(field(mounted, '[name="business_email"]').attributes('aria-invalid')).toBe('true')
    expect(field(mounted, '[name="business_email"]').attributes('aria-describedby')).toContain('business_email-error')
    expect(mounted.find('#business_email-error[role="alert"]').exists()).toBe(true)
    expect(field(mounted, '[name="product_url"]').attributes('aria-invalid')).toBe('true')
  })

  test.each([
    [new OutreachApiError('validation', 422, { business_email: ['Check this field.'] }), 'Check this field.', 'business_email'],
    [new OutreachApiError('conflict', 409), 'conflicts with the current candidate state', null],
  ] as const)('preserves submitted values and never retries backend errors', async (error, message, errorField) => {
    const client = api({ createCandidate: vi.fn().mockRejectedValue(error) })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(NewPage)
    await settle()
    await completeCandidateForm(mounted)
    await field(mounted, 'form').trigger('submit')
    await settle()

    expect(client.createCandidate).toHaveBeenCalledOnce()
    expect(field(mounted, '[name="company_name"]').element.value).toBe('Example Labs')
    expect(field(mounted, '[name="business_email"]').element.value).toBe(BUSINESS_EMAIL)
    expect(mounted.text()).toContain(message)
    if (errorField) {
      expect(field(mounted, `[name="${errorField}"]`).attributes('aria-invalid')).toBe('true')
      expect(mounted.find(`#${errorField}-error[role="alert"]`).text()).toContain(message)
    }
    expect(button(mounted, 'Create candidate').attributes('disabled')).toBeUndefined()
  })

  test('submits one exact normalized payload, locks duplicates, and navigates on a full Resource', async () => {
    const createResult = deferred<OutreachCandidateDetail>()
    const returned = candidate({ public_id: OTHER_PUBLIC_ID })
    const client = api({ createCandidate: vi.fn(() => createResult.promise) })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(NewPage)
    await settle()
    await completeCandidateForm(mounted)

    await field(mounted, 'form').trigger('submit')
    await nextTick()
    expect(client.createCandidate).toHaveBeenCalledWith({
      campaign_key: 'founder-signals',
      company_name: 'Example Labs',
      product_name: 'Signal Desk',
      product_url: 'https://product.example.invalid',
      founder_first_name: null,
      business_email: BUSINESS_EMAIL,
      country_code: null,
      source_url: 'https://evidence.example.invalid/release',
      source_context: 'Public launch announcement.',
      notes: null,
      source_attested: true,
    }, expect.anything())
    expect(button(mounted, 'Creating candidate…').attributes('disabled')).toBeDefined()
    await field(mounted, 'form').trigger('submit')
    expect(client.createCandidate).toHaveBeenCalledOnce()

    createResult.resolve(returned)
    await settle()
    expect(client.getCandidate).not.toHaveBeenCalled()
    expect(testDoubles.validateCommittedRecovery).not.toHaveBeenCalled()
    expect(testDoubles.navigateTo).toHaveBeenCalledWith(`/admin/outreach/${OTHER_PUBLIC_ID}`)
  })

  test.each([
    ['rejects', () => Promise.reject(new Error('Local navigation unavailable'))],
    ['returns false', () => Promise.resolve(false)],
  ] as const)('locks an already-committed full Resource when navigation %s', async (_outcome, navigate) => {
    const returned = candidate({ public_id: OTHER_PUBLIC_ID })
    const client = api({ createCandidate: vi.fn().mockResolvedValue(returned) })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    testDoubles.navigateTo.mockImplementationOnce(navigate)
    const mounted = await mountTaskComponent(NewPage)
    await settle()
    await completeCandidateForm(mounted)

    await field(mounted, 'form').trigger('submit')
    await settle()

    expect(client.createCandidate).toHaveBeenCalledOnce()
    expect(client.getCandidate).not.toHaveBeenCalled()
    expect(testDoubles.validateCommittedRecovery).not.toHaveBeenCalled()
    expect(testDoubles.navigateTo).toHaveBeenCalledWith(`/admin/outreach/${OTHER_PUBLIC_ID}`)
    expect(mounted.text()).toContain('The candidate was saved')
    expect(mounted.find(`a[href="/admin/outreach/${OTHER_PUBLIC_ID}"]`).exists()).toBe(true)
    const create = mounted.findAll('button').find(item => item.text().trim() === 'Create candidate')
    expect(create === undefined || create.attributes('disabled') !== undefined).toBe(true)

    const form = mounted.find('form')
    if (form.exists()) await form.trigger('submit')
    await settle()
    expect(client.createCandidate).toHaveBeenCalledOnce()
  })

  test('performs one create and validates committed recovery before one read-only follow-up', async () => {
    const recovery = {
      public_id: PUBLIC_ID,
      persistence_status: 'committed' as const,
      recovery_url: `/api/v1/admin/outreach/candidates/${PUBLIC_ID}`,
    }
    const client = api({
      createCandidate: vi.fn().mockResolvedValue(recovery),
      getCandidate: vi.fn().mockResolvedValue(candidate()),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    testDoubles.validateCommittedRecovery.mockReturnValue(PUBLIC_ID)
    const mounted = await mountTaskComponent(NewPage)
    await settle()

    await mounted.find('input[type="radio"][value="founder-signals"]').setValue(true)
    await mounted.find('[name="company_name"]').setValue('Example Labs')
    await mounted.find('[name="product_name"]').setValue('Signal Desk')
    await mounted.find('[name="product_url"]').setValue('https://product.example.invalid')
    await mounted.find('[name="business_email"]').setValue(BUSINESS_EMAIL)
    await mounted.find('[name="source_url"]').setValue('https://evidence.example.invalid/release')
    await mounted.find('[name="source_context"]').setValue('Public launch announcement.')
    await mounted.find('[name="source_attested"]').setValue(true)
    await mounted.find('form').trigger('submit')
    await settle()

    expect(client.createCandidate).toHaveBeenCalledOnce()
    expect(testDoubles.validateCommittedRecovery).toHaveBeenCalledWith(recovery)
    expect(client.getCandidate).toHaveBeenCalledWith(PUBLIC_ID)
    expect(client.createCandidate).toHaveBeenCalledTimes(1)
    expect(testDoubles.navigateTo).toHaveBeenCalledWith(`/admin/outreach/${PUBLIC_ID}`)
  })

  test('retains committed guidance without replay when recovery follow-up fails', async () => {
    const recovery = {
      public_id: PUBLIC_ID,
      persistence_status: 'committed' as const,
      recovery_url: `/api/v1/admin/outreach/candidates/${PUBLIC_ID}`,
    }
    const client = api({
      createCandidate: vi.fn().mockResolvedValue(recovery),
      getCandidate: vi.fn().mockRejectedValue(new OutreachApiError('network')),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    testDoubles.validateCommittedRecovery.mockReturnValue(PUBLIC_ID)
    const mounted = await mountTaskComponent(NewPage)
    await settle()

    await mounted.find('input[type="radio"][value="founder-signals"]').setValue(true)
    for (const [name, value] of Object.entries({
      company_name: 'Example Labs', product_name: 'Signal Desk', product_url: 'https://product.example.invalid',
      business_email: BUSINESS_EMAIL, source_url: 'https://evidence.example.invalid/release', source_context: 'Public announcement.',
    })) await mounted.find(`[name="${name}"]`).setValue(value)
    await mounted.find('[name="source_attested"]').setValue(true)
    await mounted.find('form').trigger('submit')
    await settle()

    expect(client.createCandidate).toHaveBeenCalledOnce()
    expect(client.getCandidate).toHaveBeenCalledOnce()
    expect(mounted.text()).toContain('The candidate was saved')
    expect(mounted.find(`a[href="/admin/outreach/${PUBLIC_ID}"]`).exists()).toBe(true)
    expect(mounted.text()).not.toContain('Create again')
  })

  test('treats a malformed committed envelope as refresh-required and never replays create', async () => {
    const malformed = {
      public_id: PUBLIC_ID.toLowerCase(),
      persistence_status: 'committed' as const,
      recovery_url: '/api/v1/admin/outreach/candidates/not-canonical',
    }
    const client = api({ createCandidate: vi.fn().mockResolvedValue(malformed) })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    testDoubles.validateCommittedRecovery.mockImplementation(() => { throw new OutreachApiError('server') })
    const mounted = await mountTaskComponent(NewPage)
    await settle()
    await completeCandidateForm(mounted)
    await field(mounted, 'form').trigger('submit')
    await settle()

    expect(client.createCandidate).toHaveBeenCalledOnce()
    expect(testDoubles.validateCommittedRecovery).toHaveBeenCalledWith(malformed)
    expect(client.getCandidate).not.toHaveBeenCalled()
    expect(testDoubles.navigateTo).not.toHaveBeenCalled()
    expect(mounted.text()).toContain('Refresh required')
    expect(mounted.text()).toContain('LaunchLog could not verify the saved candidate response')
    expect(mounted.text()).not.toContain('Create again')
  })
})

describe('candidate review workspace', () => {
  test.each([
    [undefined, '/admin/outreach'],
    [['01ARZ3NDEKTSV4RRFFQ69G5FAV'], '/admin/outreach/01ARZ3NDEKTSV4RRFFQ69G5FAV'],
    [PUBLIC_ID, `/admin/outreach/%30${PUBLIC_ID.slice(1)}`],
  ])('rejects a missing, array, or raw-path aliased id %j at the page boundary', async (publicId, fullPath) => {
    testDoubles.route.params = publicId === undefined ? {} : { publicId }
    testDoubles.route.fullPath = fullPath
    testDoubles.route.path = fullPath
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(mounted.find('[role="alert"]').text()).toContain('invalid candidate identifier')
    expect(testDoubles.useOutreachCandidatePage).not.toHaveBeenCalled()
    expect(testDoubles.useAdminOutreach).not.toHaveBeenCalled()
  })

  test.each([
    '01arz3ndektsv4rrffq69g5fav',
    '01ArZ3NDEKTSV4RRFFQ69G5FAV',
    'not-a-candidate',
  ])('lets the controller reject string id %s before auth or API work', async (publicId) => {
    const invalidController = controller()
    invalidController.state.candidate = null
    invalidController.state.load = 'idle'
    invalidController.load = vi.fn().mockImplementation(async () => {
      invalidController.state.load = 'load_error'
      invalidController.state.load_error = new OutreachApiError('validation')
      throw invalidController.state.load_error
    })
    testDoubles.useOutreachCandidatePage.mockReturnValue(invalidController)
    testDoubles.route.params = { publicId }
    testDoubles.route.path = `/admin/outreach/${publicId}`
    testDoubles.route.fullPath = `/admin/outreach/${publicId}`

    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(testDoubles.useOutreachCandidatePage).toHaveBeenCalledWith(publicId)
    expect(invalidController.load).toHaveBeenCalledOnce()
    expect(testDoubles.useAdminOutreach).not.toHaveBeenCalled()
    expect(mounted.find('[role="alert"]').text()).toContain('invalid candidate identifier')
  })

  test('constructs one controller for a canonical id, loads once, and disposes on unmount', async () => {
    const candidateController = controller()
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    testDoubles.route.params = { publicId: PUBLIC_ID }
    testDoubles.route.path = `/admin/outreach/${PUBLIC_ID}`
    testDoubles.route.fullPath = `/admin/outreach/${PUBLIC_ID}?panel=review#evidence`

    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(testDoubles.useOutreachCandidatePage).toHaveBeenCalledOnce()
    expect(testDoubles.useOutreachCandidatePage).toHaveBeenCalledWith(PUBLIC_ID)
    expect(candidateController.load).toHaveBeenCalledOnce()
    expect(mounted.text()).toContain('Signal Desk')
    mounted.unmount()
    expect(candidateController.dispose).toHaveBeenCalledOnce()
  })

  test.each([
    ['idle', 'Preparing candidate workspace'],
    ['loading', 'Loading outreach candidate'],
  ] as const)('renders the %s load state without stale candidate content', async (loadState, copy) => {
    const candidateController = controller()
    candidateController.state.candidate = null
    candidateController.state.load = loadState
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(mounted.text()).toContain(copy)
    expect(mounted.text()).not.toContain(BUSINESS_EMAIL)
    expect(candidateController.load).toHaveBeenCalledOnce()
  })

  test('renders a safe initial load error and retries through the same controller', async () => {
    const candidateController = controller()
    candidateController.state.candidate = null
    candidateController.state.load = 'idle'
    candidateController.load = vi.fn()
      .mockImplementationOnce(async () => {
        candidateController.state.load = 'load_error'
        candidateController.state.load_error = new OutreachApiError('network')
        throw candidateController.state.load_error
      })
      .mockImplementationOnce(async () => {
        candidateController.state.candidate = candidate()
        candidateController.state.load = 'ready'
        candidateController.state.load_error = null
      })
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(mounted.find('[role="alert"]').text()).toContain('Could not reach LaunchLog')
    await button(mounted, 'Retry').trigger('click')
    await settle()
    expect(candidateController.load).toHaveBeenCalledTimes(2)
    expect(mounted.text()).toContain('Signal Desk')
  })

  test('disposes the opaque-id controller on route change and constructs a fresh one only after remount', async () => {
    const first = controller()
    const second = controller(candidate({ public_id: OTHER_PUBLIC_ID }))
    testDoubles.useOutreachCandidatePage.mockReturnValueOnce(first).mockReturnValueOnce(second)
    setDetailRoute(PUBLIC_ID)
    const firstMount = await mountTaskComponent(DetailPage)
    await settle()

    testDoubles.route.params = { publicId: OTHER_PUBLIC_ID }
    testDoubles.route.path = `/admin/outreach/${OTHER_PUBLIC_ID}`
    testDoubles.route.fullPath = `/admin/outreach/${OTHER_PUBLIC_ID}`
    await settle()
    expect(first.dispose).toHaveBeenCalledOnce()
    expect(testDoubles.useOutreachCandidatePage).toHaveBeenCalledTimes(1)

    firstMount.unmount()
    const secondMount = await mountTaskComponent(DetailPage)
    await settle()
    expect(testDoubles.useOutreachCandidatePage).toHaveBeenNthCalledWith(2, OTHER_PUBLIC_ID)
    expect(second.load).toHaveBeenCalledOnce()
    secondMount.unmount()
  })

  test.each([
    ['preview_generating', 'generating', false, false, false, false],
    ['ready_for_review', 'ready', true, false, false, false],
    ['failed', 'failed', false, true, false, false],
    ['expired', 'expired', false, false, true, false],
    ['suppressed', 'ready', false, false, false, false],
    ['converted', 'converted', false, false, false, false],
  ] as const)('renders action boundaries for %s/%s', async (effective, previewStatus, approve, recapture, renew, exportAllowed) => {
    const detail = candidate({
      effective_status: effective,
      preview: {
        ...candidate().preview!,
        status: previewStatus,
        expires_at: previewStatus === 'expired' ? new Date(NOW - DAY).toISOString() : new Date(NOW + 3 * DAY).toISOString(),
      },
    })
    const candidateController = controller(detail)
    if (approve) {
      candidateController.state.approval_english_plain_text = true
      candidateController.state.approval_public_source = true
    }
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    testDoubles.route.params = { publicId: PUBLIC_ID }
    testDoubles.route.path = `/admin/outreach/${PUBLIC_ID}`
    testDoubles.route.fullPath = `/admin/outreach/${PUBLIC_ID}`
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(button(mounted, 'Approve')?.attributes('disabled') === undefined).toBe(approve)
    expect(button(mounted, 'Recapture preview')?.attributes('disabled') === undefined).toBe(recapture)
    expect(button(mounted, 'Renew preview')?.attributes('disabled') === undefined).toBe(renew)
    expect(button(mounted, 'Download CSV')?.attributes('disabled') === undefined).toBe(exportAllowed)
  })

  test('clicks Save draft through the controller after an explicit draft edit', async () => {
    const candidateController = controller()
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    await field(mounted, '[name="subject_line"]').setValue('A revised plain-text subject')
    expect(candidateController.setDraftField).toHaveBeenCalledWith('subject_line', 'A revised plain-text subject')
    expect(button(mounted, 'Save draft').attributes('disabled')).toBeUndefined()
    await button(mounted, 'Save draft').trigger('click')
    await settle()
    expect(candidateController.saveDraft).toHaveBeenCalledWith()
    expect(candidateController.saveDraft).toHaveBeenCalledOnce()
  })

  test.each([
    ['failed preview', candidate({ effective_status: 'failed', preview: { ...candidate().preview!, status: 'failed' } }), 'Recapture preview', 'recapture'],
    ['expired preview', candidate({ effective_status: 'expired', preview: { ...candidate().preview!, status: 'expired', expires_at: new Date(NOW - DAY).toISOString() } }), 'Renew preview', 'renew'],
  ] as const)('clicks the valid %s action through the controller', async (_state, detail, label, method) => {
    const candidateController = controller(detail)
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(button(mounted, label).attributes('disabled')).toBeUndefined()
    await button(mounted, label).trigger('click')
    await settle()
    expect(candidateController[method]).toHaveBeenCalledWith()
    expect(candidateController[method]).toHaveBeenCalledOnce()
  })

  test.each([
    ['approved', 'approved', 'active', 0, true, false, 'Approved'],
    ['exported', 'exported', 'active', 2, false, true, 'Exported 2 times'],
    ['approved', 'approved', 'draft', 0, false, false, 'Enable CSV export in LaunchLog'],
    ['approved', 'approved', 'archived', 0, false, false, 'Archived campaigns are terminal'],
  ] as const)('renders persisted %s in a %s campaign with durable audit', async (persisted, effective, campaignStatus, exportCount, exportEnabled, needsReexport, copy) => {
    const detail = candidate({
      persisted_status: persisted,
      effective_status: effective,
      campaign: { ...candidate().campaign, status: campaignStatus },
      audit: {
        approved_at: '2026-08-25T10:00:00.000Z',
        approved_by: { name: 'Admin reviewer', email: null },
        exported_at: exportCount > 0 ? '2026-08-25T11:00:00.000Z' : null,
        exported_by: exportCount > 0 ? { name: 'Admin exporter', email: null } : null,
        export_count: exportCount,
        last_export_hash: exportCount > 0 ? AUDIT_HASH : null,
      },
    })
    const candidateController = controller(detail)
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(mounted.text()).toContain('Admin reviewer')
    expect(mounted.text()).toContain(copy)
    expect(mounted.text()).not.toContain(AUDIT_HASH)
    expect(button(mounted, 'Download CSV').attributes('disabled') === undefined).toBe(exportEnabled)
    expect(mounted.find('[name="confirm_reexport"]').exists()).toBe(needsReexport)
    if (campaignStatus === 'archived') {
      for (const action of ['Save prospect', 'Save draft', 'Approve', 'Recapture preview', 'Renew preview', 'Download CSV']) {
        expect(button(mounted, action).attributes('disabled')).toBeDefined()
      }
      expect(field(mounted, '[name="suppression_target"][value="product_domain"]').exists()).toBe(true)
      expect(button(mounted, 'Suppress permanently').attributes('disabled')).toBeDefined()
      await field(mounted, '[name="suppression_target"][value="product_domain"]').setValue(true)
      await field(mounted, '[name="suppression_reason"]').setValue('Public opt-out request')
      await field(mounted, '[name="suppression_confirm"]').setValue(true)
      expect(button(mounted, 'Suppress permanently').attributes('disabled')).toBeUndefined()
    }
  })

  test('renders controller-owned generating poll, deadline, manual refresh, and transient error without a page timer', async () => {
    const generating = candidate({
      effective_status: 'preview_generating',
      preview: { ...candidate().preview!, status: 'generating' },
    })
    const candidateController = controller(generating)
    candidateController.state.poll_active = true
    candidateController.state.poll_error = new OutreachApiError('network')
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const intervalSpy = vi.spyOn(globalThis, 'setInterval')
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(mounted.text()).toContain('Preview generation in progress')
    expect(mounted.text()).toContain('Automatic checks are active')
    expect(mounted.text()).toContain('Could not reach LaunchLog')
    expect(mounted.text()).toContain('Signal Desk')
    expect(intervalSpy).not.toHaveBeenCalled()
    await button(mounted, 'Refresh').trigger('click')
    expect(candidateController.refresh).toHaveBeenCalledOnce()

    candidateController.state.poll_active = false
    candidateController.state.poll_deadline_reached = true
    await nextTick()
    expect(mounted.text()).toContain('Automatic checks stopped after 10 minutes')
    expect(button(mounted, 'Refresh').attributes('disabled')).toBeUndefined()
  })

  test('keeps loaded content visible and disables duplicates for every pending action', async () => {
    const candidateController = controller(candidate({
      persisted_status: 'approved',
      effective_status: 'approved',
      audit: {
        ...candidate().audit,
        approved_at: '2026-08-25T10:00:00.000Z',
        approved_by: { name: 'Admin reviewer', email: null },
      },
    }))
    candidateController.state.action = { name: 'export', phase: 'pending' }
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(mounted.text()).toContain('Signal Desk')
    expect(mounted.text()).toContain('Working…')
    for (const action of ['Save prospect', 'Save draft', 'Approve', 'Recapture preview', 'Renew preview', 'Download CSV', 'Suppress permanently']) {
      expect(button(mounted, action).attributes('disabled')).toBeDefined()
    }
  })

  test('requires the controller-bound CSV-only confirmation before activating a draft campaign', async () => {
    const candidateController = controller(candidate({
      campaign: { ...candidate().campaign, status: 'draft' },
    }))
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(button(mounted, 'Enable CSV export in LaunchLog').attributes('disabled')).toBeUndefined()
    await button(mounted, 'Enable CSV export in LaunchLog').trigger('click')
    expect(candidateController.activateCampaign).not.toHaveBeenCalled()
    expect(mounted.text()).toContain('This changes LaunchLog CSV eligibility only')
    await field(mounted, '[name="confirm_campaign_activation"]').setValue(true)
    expect(candidateController.setCampaignActivationConfirmed).toHaveBeenCalledWith(true)
    await button(mounted, 'Confirm CSV eligibility').trigger('click')
    expect(candidateController.activateCampaign).toHaveBeenCalledOnce()
    expect(mounted.text().toLowerCase()).not.toContain('smartlead')
  })

  test.each([
    [48 * 60 * 60 * 1000, true, true],
    [24 * 60 * 60 * 1000, true, true],
    [24 * 60 * 60 * 1000 - 1, false, true],
  ])('renders the non-ticking TTL snapshot at %i ms', async (remaining, approvalAllowed, renewalAllowed) => {
    const detail = candidate({ preview: { ...candidate().preview!, expires_at: new Date(NOW + remaining).toISOString() } })
    const candidateController = controller(detail)
    candidateController.state.approval_english_plain_text = true
    candidateController.state.approval_public_source = true
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    testDoubles.route.params = { publicId: PUBLIC_ID }
    testDoubles.route.path = `/admin/outreach/${PUBLIC_ID}`
    testDoubles.route.fullPath = `/admin/outreach/${PUBLIC_ID}`
    const pageInterval = vi.spyOn(globalThis, 'setInterval')
    const pageTimeout = vi.spyOn(globalThis, 'setTimeout')
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(mounted.text()).toContain('Remaining at last refresh')
    expect(button(mounted, 'Approve')?.attributes('disabled') === undefined).toBe(approvalAllowed)
    expect(button(mounted, 'Renew preview')?.attributes('disabled') === undefined).toBe(renewalAllowed)
    expect(pageInterval).not.toHaveBeenCalled()
    expect(pageTimeout).not.toHaveBeenCalled()
  })

  test('renders the real placement adapter and immutable public evidence without a public preview cast', async () => {
    const detail = candidate()
    const candidateController = controller(detail)
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    testDoubles.route.params = { publicId: PUBLIC_ID }
    testDoubles.route.path = `/admin/outreach/${PUBLIC_ID}`
    testDoubles.route.fullPath = `/admin/outreach/${PUBLIC_ID}`
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(mounted.text()).toContain(detail.preview!.title!)
    expect(mounted.text()).toContain(detail.preview!.tagline!)
    expect(mounted.text()).toContain(detail.preview!.normalized_domain!)
    expect(mounted.find(`a[href="${detail.prospect.source_url}"][target="_blank"][rel="noopener noreferrer"]`).exists()).toBe(true)
    expect(mounted.find(`a[href="${detail.preview!.preview_url}"][target="_blank"][rel="noopener noreferrer"]`).exists()).toBe(true)
    expect(mounted.find(`input[value="${detail.prospect.product_url}"][readonly]`).exists()).toBe(true)
  })

  test('groups choice controls semantically and keeps every representative field described', async () => {
    const candidateController = controller()
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    for (const selector of [
      '[name="confirm_english_plain_text"]',
      '[name="suppression_target"]',
      '[name="suppression_source"]',
    ]) {
      const choice = field(mounted, selector)
      const group = choice.element.closest('fieldset')
      expect(group, `choice ${selector} requires a fieldset`).not.toBeNull()
      expect(group!.querySelector(':scope > legend')?.textContent?.trim()).toBeTruthy()
    }
    for (const name of ['company_name', 'subject_line', 'confirm_english_plain_text', 'suppression_reason']) {
      const control = field(mounted, `[name="${name}"]`)
      const describedBy = control.attributes('aria-describedby')?.trim().split(/\s+/) ?? []
      expect(describedBy.length).toBeGreaterThan(0)
      for (const id of describedBy) expect(mounted.findAll('[id]').some(node => node.attributes('id') === id)).toBe(true)
    }
  })

  test('adapts a null managed preview to submitted product/domain fallback without inventing a screenshot', async () => {
    const detail = candidate({ preview: null })
    const candidateController = controller(detail)
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(mounted.text()).toContain(detail.prospect.product_name)
    expect(mounted.text()).toContain(detail.prospect.normalized_domain)
    expect(mounted.text()).toContain('Your one-line pitch goes here')
    expect(mounted.find('img').exists()).toBe(false)
    expect(mounted.text()).not.toContain('public preview')
  })

  test('keeps loaded content visible while stale, refresh-required, action, and poll errors remain independent', async () => {
    const candidateController = controller()
    candidateController.state.prospect_edit = 'stale'
    candidateController.state.refresh_required = true
    candidateController.state.action_error = new OutreachApiError('server')
    candidateController.state.poll_error = new OutreachApiError('network')
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    testDoubles.route.params = { publicId: PUBLIC_ID }
    testDoubles.route.path = `/admin/outreach/${PUBLIC_ID}`
    testDoubles.route.fullPath = `/admin/outreach/${PUBLIC_ID}`
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(mounted.text()).toContain('Signal Desk')
    expect(mounted.text()).toContain('This candidate changed')
    expect(mounted.text()).toContain('Refresh required')
    expect(mounted.text()).toContain('Could not reach LaunchLog')
    expect(button(mounted, 'Approve')?.attributes('disabled')).toBeDefined()
  })

  test('uses controller setters/actions for edits, confirmation-bound approval, and candidate-derived suppression', async () => {
    const candidateController = controller()
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    testDoubles.route.params = { publicId: PUBLIC_ID }
    testDoubles.route.path = `/admin/outreach/${PUBLIC_ID}`
    testDoubles.route.fullPath = `/admin/outreach/${PUBLIC_ID}`
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    await mounted.find('[name="company_name"]').setValue('Corrected Labs')
    expect(candidateController.setProspectField).toHaveBeenCalledWith('company_name', 'Corrected Labs')
    await button(mounted, 'Save prospect')!.trigger('click')
    expect(candidateController.saveProspect).toHaveBeenCalledOnce()

    await mounted.find('[name="confirm_english_plain_text"]').setValue(true)
    await mounted.find('[name="confirm_public_source"]').setValue(true)
    await button(mounted, 'Approve')!.trigger('click')
    expect(candidateController.setApprovalEnglishPlainText).toHaveBeenCalledWith(true)
    expect(candidateController.setApprovalPublicSource).toHaveBeenCalledWith(true)
    expect(candidateController.approve).toHaveBeenCalledOnce()

    await mounted.find('[name="suppression_target"][value="product_domain"]').setValue(true)
    await mounted.find('[name="suppression_reason"]').setValue('Public opt-out request')
    await mounted.find('[name="suppression_source"][value="opt_out"]').setValue(true)
    await mounted.find('[name="suppression_confirm"]').setValue(true)
    await button(mounted, 'Suppress permanently')!.trigger('click')
    expect(candidateController.setSuppressionTarget).toHaveBeenCalledWith('product_domain')
    expect(candidateController.suppress).toHaveBeenCalledOnce()
    expect(mounted.find('[name="suppression_value"]').exists()).toBe(false)
    expect(mounted.text()).not.toContain('Unsuppress')
  })

  test('preserves dirty prospect, draft, and suppression values across a poll-owned candidate replacement', async () => {
    const candidateController = controller(candidate({ effective_status: 'preview_generating' }))
    candidateController.state.prospect_form.company_name = 'Unsaved company'
    candidateController.state.draft_form.subject_line = 'Unsaved subject'
    candidateController.state.suppression_draft = {
      target: 'product_domain', reason: 'Unsaved opt-out evidence', source: 'opt_out', confirmed: false, confirmed_revision: null,
    }
    candidateController.state.prospect_edit = 'dirty'
    candidateController.state.draft_edit = 'dirty'
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    candidateController.state.candidate = candidate({
      revision: 8,
      effective_status: 'ready_for_review',
      audit: { ...candidate().audit, approved_at: '2026-08-26T11:00:00.000Z', approved_by: { name: 'Poll reviewer', email: null } },
    })
    await nextTick()

    expect(field(mounted, '[name="company_name"]').element.value).toBe('Unsaved company')
    expect(field(mounted, '[name="subject_line"]').element.value).toBe('Unsaved subject')
    expect(field(mounted, '[name="suppression_reason"]').element.value).toBe('Unsaved opt-out evidence')
    expect(mounted.text()).toContain('Revision 8')
    expect(mounted.text()).toContain('Poll reviewer')
  })

  test('opens explicit discard confirmation for dirty refresh; cancel preserves and confirm performs one controller GET path', async () => {
    const candidateController = controller()
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()
    await field(mounted, '[name="company_name"]').setValue('Unsaved company')
    await field(mounted, '[name="subject_line"]').setValue('Unsaved subject')
    await field(mounted, '[name="suppression_reason"]').setValue('Unsaved suppression')

    await button(mounted, 'Refresh').trigger('click')
    await nextTick()
    expect(candidateController.refresh).toHaveBeenCalledOnce()
    expect(mounted.text()).toContain('Discard all unsaved changes?')
    await button(mounted, 'Keep editing').trigger('click')
    expect(candidateController.cancelDiscardRefresh).toHaveBeenCalledOnce()
    expect(field(mounted, '[name="company_name"]').element.value).toBe('Unsaved company')

    await button(mounted, 'Refresh').trigger('click')
    await button(mounted, 'Discard and refresh').trigger('click')
    await settle()
    expect(candidateController.confirmDiscardAndRefresh).toHaveBeenCalledOnce()
    expect(candidateController.load).toHaveBeenCalledOnce()
    expect(field(mounted, '[name="company_name"]').element.value).toBe('Example Labs')
    expect(field(mounted, '[name="subject_line"]').element.value).toBe('A private LaunchLog preview')
    expect(field(mounted, '[name="suppression_reason"]').element.value).toBe('')
  })

  test('adopts only the controller-returned revision and keeps a stale 409 field-bound without replay', async () => {
    const candidateController = controller()
    candidateController.saveProspect = vi.fn().mockImplementation(async () => {
      candidateController.state.candidate = candidate({ revision: 11 })
      candidateController.state.prospect_edit = 'clean'
    })
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()
    await field(mounted, '[name="company_name"]').setValue('Revision-safe company')
    await button(mounted, 'Save prospect').trigger('click')
    await settle()
    expect(candidateController.saveProspect).toHaveBeenCalledOnce()
    expect(mounted.text()).toContain('Revision 11')
    expect(mounted.text()).not.toContain('Revision 8')

    candidateController.state.prospect_edit = 'stale'
    candidateController.state.action_error = new OutreachApiError('stale_revision', 409)
    candidateController.state.action = { name: 'save_prospect', phase: 'action_error' }
    await nextTick()
    expect(mounted.text()).toContain('This candidate changed')
    expect(button(mounted, 'Save prospect').attributes('disabled')).toBeDefined()
    expect(candidateController.saveProspect).toHaveBeenCalledOnce()
  })

  test('resets both approval confirmations on relevant edits and requires explicit Save-before-Approve', async () => {
    const candidateController = controller()
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    await field(mounted, '[name="confirm_english_plain_text"]').setValue(true)
    await field(mounted, '[name="confirm_public_source"]').setValue(true)
    expect(button(mounted, 'Approve').attributes('disabled')).toBeUndefined()
    await field(mounted, '[name="opening_line"]').setValue('Edited after confirmation')
    await nextTick()
    expect(field(mounted, '[name="confirm_english_plain_text"]').element.checked).toBe(false)
    expect(field(mounted, '[name="confirm_public_source"]').element.checked).toBe(false)
    expect(button(mounted, 'Approve').attributes('disabled')).toBeDefined()
    expect(mounted.text()).toContain('Save the draft before approval')
    expect(candidateController.approve).not.toHaveBeenCalled()
  })

  test('delegates approval only after both confirmations and adopts the reactive controller result', async () => {
    const returned = candidate({
      persisted_status: 'approved',
      effective_status: 'approved',
      revision: 8,
      audit: { ...candidate().audit, approved_at: '2026-08-26T11:00:00.000Z', approved_by: { name: 'Admin reviewer', email: null } },
    })
    const candidateController = controller()
    candidateController.approve = vi.fn().mockImplementation(async () => {
      candidateController.state.candidate = returned
      candidateController.state.approval_english_plain_text = false
      candidateController.state.approval_public_source = false
    })
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()
    await field(mounted, '[name="confirm_english_plain_text"]').setValue(true)
    await field(mounted, '[name="confirm_public_source"]').setValue(true)
    await button(mounted, 'Approve').trigger('click')
    await settle()

    expect(candidateController.setApprovalEnglishPlainText).toHaveBeenCalledWith(true)
    expect(candidateController.setApprovalPublicSource).toHaveBeenCalledWith(true)
    expect(candidateController.approve).toHaveBeenCalledWith()
    expect(candidateController.approve).toHaveBeenCalledOnce()
    expect(candidateController.state.candidate?.revision).toBe(8)
    expect(candidateController.state.approval_english_plain_text).toBe(false)
    expect(candidateController.state.approval_public_source).toBe(false)
    expect(mounted.text()).toContain('Admin reviewer')
  })

  test('binds safe 422 errors to the current field while preserving loaded data', async () => {
    const candidateController = controller()
    candidateController.state.validation_errors = { subject_line: ['Check this field.'] }
    candidateController.state.action_error = new OutreachApiError('validation', 422, { subject_line: ['Check this field.'] })
    candidateController.state.action = { name: 'save_draft', phase: 'validation_error' }
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(mounted.text()).toContain('Signal Desk')
    expect(field(mounted, '[name="subject_line"]').attributes('aria-invalid')).toBe('true')
    expect(mounted.find('#subject_line-error[role="alert"]').text()).toContain('Check this field.')
  })

  test('delegates candidate-derived suppression, resets the reactive draft, and keeps durable audit', async () => {
    const initial = candidate({
      persisted_status: 'exported',
      effective_status: 'exported',
      preview: { ...candidate().preview!, normalized_domain: 'effective.example.invalid' },
      audit: {
        approved_at: '2026-08-25T10:00:00.000Z',
        approved_by: { name: 'Admin reviewer', email: null },
        exported_at: '2026-08-25T11:00:00.000Z',
        exported_by: { name: 'Admin exporter', email: null },
        export_count: 2,
        last_export_hash: AUDIT_HASH,
      },
    })
    const suppressed = candidate({
      ...initial,
      revision: 8,
      effective_status: 'suppressed',
      suppressions: [{
        kind: 'domain',
        normalized_value: 'effective.example.invalid',
        reason: 'Requested suppression',
        source: 'opt_out',
        created_by: { name: 'Suppression reviewer', email: null },
        created_at: '2026-08-26T12:00:00.000Z',
        updated_at: '2026-08-26T12:00:00.000Z',
        matched_targets: ['effective_domain'],
      }],
    })
    const candidateController = controller(initial)
    candidateController.suppress = vi.fn().mockImplementation(async () => {
      candidateController.state.candidate = suppressed
      candidateController.state.suppression_draft = {
        target: null, reason: '', source: 'manual', confirmed: false, confirmed_revision: null,
      }
    })
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(mounted.text()).toContain(BUSINESS_EMAIL)
    expect(mounted.text()).toContain('product.example.invalid')
    expect(mounted.text()).toContain('effective.example.invalid')
    await field(mounted, '[name="suppression_target"][value="effective_domain"]').setValue(true)
    await field(mounted, '[name="suppression_reason"]').setValue('  Requested suppression  ')
    await field(mounted, '[name="suppression_source"][value="opt_out"]').setValue(true)
    await field(mounted, '[name="suppression_confirm"]').setValue(true)
    expect(button(mounted, 'Suppress permanently').attributes('disabled')).toBeUndefined()

    await field(mounted, '[name="suppression_source"][value="manual"]').setValue(true)
    expect(field(mounted, '[name="suppression_confirm"]').element.checked).toBe(false)
    expect(button(mounted, 'Suppress permanently').attributes('disabled')).toBeDefined()
    await field(mounted, '[name="suppression_source"][value="opt_out"]').setValue(true)
    await field(mounted, '[name="suppression_confirm"]').setValue(true)
    await button(mounted, 'Suppress permanently').trigger('click')
    await settle()

    expect(candidateController.setSuppressionTarget).toHaveBeenCalledWith('effective_domain')
    expect(candidateController.setSuppressionReason).toHaveBeenCalledWith('  Requested suppression  ')
    expect(candidateController.setSuppressionSource).toHaveBeenLastCalledWith('opt_out')
    expect(candidateController.setSuppressionConfirmed).toHaveBeenLastCalledWith(true)
    expect(candidateController.suppress).toHaveBeenCalledWith()
    expect(candidateController.suppress).toHaveBeenCalledOnce()
    expect(candidateController.state.suppression_draft).toEqual({
      target: null, reason: '', source: 'manual', confirmed: false, confirmed_revision: null,
    })
    expect(mounted.text()).toContain('Suppressed')
    expect(mounted.text()).toContain('Admin reviewer')
    expect(mounted.text()).toContain('Admin exporter')
    expect(mounted.text()).toContain('Exported 2 times')
    expect(mounted.text()).not.toContain(AUDIT_HASH)
    expect(mounted.text()).not.toContain('Unsuppress')
  })

  test('downloads approved detail CSV with immediate cleanup and no second page-level audit GET', async () => {
    const blob = new Blob(['safe'], { type: 'text/csv' })
    const detail = candidate({
      persisted_status: 'approved',
      effective_status: 'approved',
      audit: {
        ...candidate().audit,
        approved_at: '2026-08-25T10:00:00.000Z',
        approved_by: { name: 'Admin reviewer', email: null },
      },
    })
    const exported = candidate({
      ...detail,
      persisted_status: 'exported',
      effective_status: 'exported',
      revision: 8,
      audit: {
        ...detail.audit,
        exported_at: '2026-08-26T11:30:00.000Z',
        exported_by: { name: 'Admin exporter', email: null },
        export_count: 1,
      },
    })
    const candidateController = controller(detail)
    candidateController.exportCandidate = vi.fn().mockImplementation(async () => {
      candidateController.state.candidate = exported
      return { blob, filename: 'launchlog-outreach-founder-signals.csv' }
    })
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()
    const dom = installDownloadSpies()

    await button(mounted, 'Download CSV').trigger('click')
    await settle()

    expect(candidateController.exportCandidate).toHaveBeenCalledWith()
    expect(candidateController.exportCandidate).toHaveBeenCalledOnce()
    expect(dom.createObjectURL).toHaveBeenCalledWith(blob)
    expect(dom.appendChild.mock.calls.filter(([node]) => node === dom.anchor)).toHaveLength(1)
    expect(dom.click).toHaveBeenCalledOnce()
    expect(dom.remove).toHaveBeenCalledOnce()
    expect(dom.revokeObjectURL).toHaveBeenCalledWith('blob:https://test.invalid/outreach-csv')
    expect(dom.anchor.getAttributeNames().sort()).toEqual(['download', 'href'])
    expect(candidateController.refresh).not.toHaveBeenCalled()
    expect(candidateController.load).toHaveBeenCalledOnce()
    expect(mounted.text()).toContain('Admin exporter')
  })

  test('requires explicit confirmation for every detail re-export and cleans the mixed audit download once', async () => {
    const detail = candidate({
      persisted_status: 'exported',
      effective_status: 'exported',
      audit: {
        approved_at: '2026-08-25T10:00:00.000Z',
        approved_by: { name: 'Admin reviewer', email: null },
        exported_at: '2026-08-25T11:00:00.000Z',
        exported_by: { name: 'Admin exporter', email: null },
        export_count: 3,
        last_export_hash: null,
      },
    })
    const candidateController = controller(detail)
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(button(mounted, 'Download CSV').attributes('disabled')).toBeDefined()
    expect(mounted.text()).toContain('Every further export requires confirmation')
    await field(mounted, '[name="confirm_reexport"]').setValue(true)
    expect(candidateController.setReexportConfirmed).toHaveBeenCalledWith(true)
    const dom = installDownloadSpies()
    await button(mounted, 'Download CSV').trigger('click')
    await settle()

    expect(candidateController.exportCandidate).toHaveBeenCalledOnce()
    expect(dom.click).toHaveBeenCalledOnce()
    expect(dom.remove).toHaveBeenCalledOnce()
    expect(dom.revokeObjectURL).toHaveBeenCalledOnce()
    expect(candidateController.refresh).not.toHaveBeenCalled()
  })
})

describe('navigation and shared placement renderer', () => {
  test('keeps one stable polite announcer through list, new-page, and detail state transitions', async () => {
    const listResult = deferred<OutreachCandidatePage>()
    testDoubles.useAdminOutreach.mockReturnValue(api({ listCandidates: vi.fn(() => listResult.promise) }))
    const listMount = await mountTaskComponent(ListPage)
    const listAnnouncer = politeAnnouncer(listMount).element
    listResult.resolve(page([summary()]))
    await settle()
    expect(politeAnnouncer(listMount).element).toBe(listAnnouncer)
    listMount.unmount()

    const campaignsResult = deferred<OutreachCampaign[]>()
    testDoubles.useAdminOutreach.mockReturnValue(api({ listCampaigns: vi.fn(() => campaignsResult.promise) }))
    const newMount = await mountTaskComponent(NewPage)
    const newAnnouncer = politeAnnouncer(newMount).element
    campaignsResult.resolve([campaign()])
    await settle()
    expect(politeAnnouncer(newMount).element).toBe(newAnnouncer)
    newMount.unmount()

    const candidateController = controller()
    candidateController.state.candidate = null
    candidateController.state.load = 'loading'
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const detailMount = await mountTaskComponent(DetailPage)
    const detailAnnouncer = politeAnnouncer(detailMount).element
    candidateController.state.candidate = candidate()
    candidateController.state.load = 'ready'
    await nextTick()
    expect(politeAnnouncer(detailMount).element).toBe(detailAnnouncer)
    detailMount.unmount()
  })

  test.each([
    [ListPage, '/admin/outreach', 'list'],
    [NewPage, '/admin/outreach/new', 'new'],
    [DetailPage, '/admin/outreach/:publicId', 'detail'],
  ] as const)('registers admin middleware and renders private head metadata for the %s page', async (component, expectedPath, kind) => {
    if (kind === 'detail') setDetailRoute()
    else {
      testDoubles.route.params = {}
      testDoubles.route.path = expectedPath
      testDoubles.route.fullPath = expectedPath
    }
    const mounted = await mountTaskComponent(component)
    await settle()
    const router = (mounted.vm as unknown as {
      $router: { getRoutes: () => Array<{ path: string, meta: Record<string, unknown> }> }
    }).$router
    const record = router.getRoutes().find((route) => {
      if (kind === 'detail') return route.path.startsWith('/admin/outreach/:publicId')
      return route.path === expectedPath
    })

    expect(record, `Nuxt route metadata must exist for ${expectedPath}`).toBeDefined()
    expect(JSON.stringify(record!.meta.middleware)).toContain('admin')
    expect(document.title.toLowerCase()).toContain('outreach')
    const robots = [...document.head.querySelectorAll('meta[name="robots"]')]
      .flatMap(meta => (meta.getAttribute('content') ?? '').toLowerCase().split(','))
      .map(directive => directive.trim())
    expect(robots).toEqual(expect.arrayContaining(['noindex', 'nofollow']))
  })

  test('keys detail remounts by the opaque raw path while stripping only query and fragment', async () => {
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()
    const router = (mounted.vm as unknown as {
      $router: { getRoutes: () => Array<{ path: string, meta: Record<string, unknown> }> }
    }).$router
    const detailRoute = router.getRoutes().find(route => route.path.startsWith('/admin/outreach/:publicId'))
    expect(detailRoute).toBeDefined()
    expect(typeof detailRoute!.meta.key).toBe('function')
    const rawPathKey = detailRoute!.meta.key as (route: { fullPath: string }) => string
    const canonical = `/admin/outreach/${PUBLIC_ID}`
    const encodedAlias = `/admin/outreach/%30${PUBLIC_ID.slice(1)}`

    expect(rawPathKey({ fullPath: `${canonical}?panel=audit#history` })).toBe(canonical)
    expect(rawPathKey({ fullPath: encodedAlias })).toBe(encodedAlias)
    expect(rawPathKey({ fullPath: encodedAlias })).not.toBe(rawPathKey({ fullPath: canonical }))
    expect(rawPathKey({ fullPath: `/admin/outreach/${PUBLIC_ID.toLowerCase()}` })).not.toBe(canonical)
  })

  test('moves desktop and mobile Admin navigation to the operations hub', async () => {
    const mounted = await mountNuxtComponent(AppBar)
    await settle()
    await mounted.find('button[aria-label="Toggle menu"]').trigger('click')
    await nextTick()

    const adminLinks = mounted.findAll('a').filter(item => item.text().trim() === 'Admin')
    expect(adminLinks).toHaveLength(2)
    for (const link of adminLinks) expect(link.attributes('href')).toBe('/admin')
  })

  test('adds Outreach to the admin hub without removing listing and screenshot operations', async () => {
    testDoubles.route.path = '/admin'
    testDoubles.route.fullPath = '/admin'
    const mounted = await mountNuxtComponent(AdminPage)
    await settle()

    expect(mounted.find('main').exists()).toBe(false)
    expect(mounted.find('a[href="/admin/outreach"]').text()).toContain('Outreach')
    expect(mounted.find('a[href="/admin/listings"]').exists()).toBe(true)
    expect(mounted.text()).toContain('Screenshot and moderation pipeline')
  })

  test('treats the router-normalized trailing slash as the admin root', async () => {
    testDoubles.route.path = '/admin/'
    testDoubles.route.fullPath = '/admin/'
    const adminClient = dashboardApi()
    testDoubles.useAdminListings.mockReturnValue(adminClient)
    const childOutlet = defineComponent({
      name: 'UnexpectedAdminChildOutlet',
      template: '<section aria-label="Unexpected admin child outlet" />',
    })

    const mounted = await mountNuxtComponent(AdminPage, {
      global: { stubs: { NuxtPage: childOutlet } },
    })
    await settle()

    expect(mounted.text()).toContain('Admin dashboard')
    expect(mounted.text()).toContain('Screenshot and moderation pipeline')
    expect(mounted.find('section[aria-label="Unexpected admin child outlet"]').exists()).toBe(false)
    expect(adminClient.dashboard).toHaveBeenCalledOnce()
    expect(adminClient.founderScreenshotStatus).toHaveBeenCalledOnce()
    expect(adminClient.runFounderScreenshots).not.toHaveBeenCalled()
  })

  test('renders the nested admin child outlet without starting dashboard or screenshot work', async () => {
    testDoubles.route.path = '/admin/outreach'
    testDoubles.route.fullPath = '/admin/outreach'
    const adminClient = dashboardApi()
    testDoubles.useAdminListings.mockReturnValue(adminClient)
    const childOutlet = defineComponent({
      name: 'AdminChildOutlet',
      template: '<section aria-label="Outreach child page outlet"><h1>Nested outreach workspace</h1></section>',
    })

    const mounted = await mountNuxtComponent(AdminPage, {
      global: { stubs: { NuxtPage: childOutlet } },
    })
    await settle()

    expect(mounted.find('section[aria-label="Outreach child page outlet"]').exists()).toBe(true)
    expect(mounted.text()).toContain('Nested outreach workspace')
    expect(mounted.text()).not.toContain('Admin dashboard')
    expect(document.title).toBe('Outreach operations · LaunchLog')
    expect(adminClient.dashboard).not.toHaveBeenCalled()
    expect(adminClient.founderScreenshotStatus).not.toHaveBeenCalled()
    expect(adminClient.runFounderScreenshots).not.toHaveBeenCalled()
  })

  test('accepts the structural placement shape with screenshot and submitted-data fallback', async () => {
    const populated = await mountNuxtComponent(PlacementPreview as Component, {
      props: {
        preview: { domain: 'product.example.invalid', screenshot_url: 'https://assets.example.invalid/screenshot.webp' },
        tier: 'featured',
        title: 'Signal Desk',
        tagline: 'A calm operations surface.',
        generating: false,
      },
    })
    expect(populated.text()).toContain('Signal Desk')
    expect(populated.text()).toContain('product.example.invalid')
    expect(populated.text()).toContain('A calm operations surface.')

    const fallback = await mountNuxtComponent(PlacementPreview as Component, {
      props: {
        preview: { domain: 'submitted.example.invalid', screenshot_url: null },
        tier: 'featured',
        title: 'Submitted product',
        tagline: '',
        generating: true,
      },
    })
    expect(fallback.text()).toContain('Submitted product')
    expect(fallback.text()).toContain('submitted.example.invalid')
    expect(fallback.text()).toContain('Your one-line pitch goes here')
  })

  test.each([ListPage, NewPage, DetailPage])('never renders delivery states, tracking, attachments, providers, or arbitrary suppression controls', async (component) => {
    testDoubles.route.params = { publicId: PUBLIC_ID }
    testDoubles.route.path = `/admin/outreach/${PUBLIC_ID}`
    testDoubles.route.fullPath = `/admin/outreach/${PUBLIC_ID}`
    const mounted = await mountTaskComponent(component)
    await settle()
    assertNoDeliverySurface(mounted)
  })
})

describe('GREEN review regressions', () => {
  test('prevents native candidate form navigation and performs exactly one private create', async () => {
    const createResult = deferred<OutreachCandidateDetail>()
    const client = api({ createCandidate: vi.fn(() => createResult.promise) })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(NewPage)
    await settle()
    await completeCandidateForm(mounted)
    const form = field<HTMLFormElement>(mounted, 'form')
    const locationBefore = window.location.href
    let defaultPrevented = false
    form.element.addEventListener('submit', event => { defaultPrevented = event.defaultPrevented })

    await form.trigger('submit')
    await nextTick()

    expect(defaultPrevented).toBe(true)
    expect(window.location.href).toBe(locationBefore)
    expect(client.createCandidate).toHaveBeenCalledOnce()
    expect(client.createCandidate).toHaveBeenCalledWith(expect.objectContaining({
      business_email: BUSINESS_EMAIL,
      source_context: 'Public launch announcement.',
    }), expect.anything())
  })

  test('latches refresh when both the browser click and authoritative reload fail', async () => {
    const client = api({
      listCandidates: vi.fn()
        .mockResolvedValueOnce(page([summary()]))
        .mockRejectedValueOnce(new OutreachApiError('network')),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()
    await candidateCheckboxes(mounted, [summary()])[0]!.setValue(true)
    const dom = installDownloadSpies({ clickError: new Error('Browser blocked download') })

    await button(mounted, 'Download CSV').trigger('click')
    await settle()

    expect(dom.click).toHaveBeenCalledOnce()
    expect(dom.remove).toHaveBeenCalledOnce()
    expect(dom.revokeObjectURL).toHaveBeenCalledOnce()
    expect(client.listCandidates).toHaveBeenCalledTimes(2)
    expect(mounted.text()).toContain('Refresh required')
    expect(button(mounted, 'Download CSV').attributes('disabled')).toBeDefined()
  })

  test('drops same-id selection when the authoritative row becomes ineligible', async () => {
    const first = summary()
    const second = summary({ effective_status: 'suppressed' })
    const client = api({
      listCandidates: vi.fn()
        .mockResolvedValueOnce(page([first]))
        .mockResolvedValueOnce(page([second])),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()
    await candidateCheckboxes(mounted, [first])[0]!.setValue(true)
    installDownloadSpies({ clickError: new Error('Browser blocked download') })

    await button(mounted, 'Download CSV').trigger('click')
    await settle()

    expect(mounted.text()).not.toContain('1 selected')
    expect(candidateCheckboxes(mounted, [second])[0]!.element.checked).toBe(false)
    expect(button(mounted, 'Download CSV').attributes('disabled')).toBeDefined()
  })

  test('clears and reloads selection after campaign archive and revalidates immediately before export', async () => {
    const eligible = summary()
    const archived = summary({ campaign_status: 'archived' })
    const listCandidates = vi.fn()
      .mockResolvedValueOnce(page([eligible]))
      .mockResolvedValueOnce(page([archived]))
    const client = api({
      listCampaigns: vi.fn().mockResolvedValue([campaign()]),
      listCandidates,
      updateCampaign: vi.fn().mockResolvedValue(campaign({ status: 'archived' })),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()
    await candidateCheckboxes(mounted, [eligible])[0]!.setValue(true)
    await button(mounted, 'Archive campaign').trigger('click')
    await button(mounted, 'Confirm permanent archive').trigger('click')
    await settle()

    expect(listCandidates).toHaveBeenCalledTimes(2)
    expect(mounted.text()).not.toContain('1 selected')
    expect(button(mounted, 'Download CSV').attributes('disabled')).toBeDefined()

    const mutable = summary()
    const directClient = api({ listCandidates: vi.fn().mockResolvedValue(page([mutable])) })
    testDoubles.useAdminOutreach.mockReturnValue(directClient)
    mounted.unmount()
    const direct = await mountTaskComponent(ListPage)
    await settle()
    await candidateCheckboxes(direct, [mutable])[0]!.setValue(true)
    mutable.effective_status = 'suppressed'
    await button(direct, 'Download CSV').trigger('click')
    await settle()
    expect(directClient.exportCandidates).not.toHaveBeenCalled()
  })

  test('keeps stale detail edit fields inert before throwing setters', async () => {
    const staleController = controller()
    staleController.state.prospect_edit = 'stale'
    staleController.state.draft_edit = 'stale'
    staleController.setProspectField = vi.fn(() => { throw new Error('stale setter reached') })
    staleController.setDraftField = vi.fn(() => { throw new Error('stale setter reached') })
    testDoubles.useOutreachCandidatePage.mockReturnValue(staleController)
    setDetailRoute()
    const stale = await mountTaskComponent(DetailPage)
    await settle()

    const company = field<HTMLInputElement>(stale, '[name="company_name"]')
    const subject = field<HTMLInputElement>(stale, '[name="subject_line"]')
    expect(company.attributes('disabled')).toBeDefined()
    expect(subject.attributes('disabled')).toBeDefined()
    await company.trigger('input')
    await subject.trigger('input')
    expect(staleController.setProspectField).not.toHaveBeenCalled()
    expect(staleController.setDraftField).not.toHaveBeenCalled()
  })

  test('keeps every suppression setter inert while a controller action is pending', async () => {
    const pendingController = controller()
    pendingController.state.action = { name: 'suppress', phase: 'pending' }
    pendingController.setSuppressionTarget = vi.fn(() => { throw new Error('pending setter reached') })
    pendingController.setSuppressionReason = vi.fn(() => { throw new Error('pending setter reached') })
    pendingController.setSuppressionSource = vi.fn(() => { throw new Error('pending setter reached') })
    pendingController.setSuppressionConfirmed = vi.fn(() => { throw new Error('pending setter reached') })
    testDoubles.useOutreachCandidatePage.mockReturnValue(pendingController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    const controls = [
      { control: field(mounted, '[name="suppression_target"][value="email"]'), event: 'change' },
      { control: field(mounted, '[name="suppression_reason"]'), event: 'input' },
      { control: field(mounted, '[name="suppression_source"][value="opt_out"]'), event: 'change' },
      { control: field(mounted, '[name="suppression_confirm"]'), event: 'change' },
    ]
    for (const { control, event } of controls) {
      expect(control.attributes('disabled')).toBeDefined()
      await control.trigger(event)
    }
    expect(pendingController.setSuppressionTarget).not.toHaveBeenCalled()
    expect(pendingController.setSuppressionReason).not.toHaveBeenCalled()
    expect(pendingController.setSuppressionSource).not.toHaveBeenCalled()
    expect(pendingController.setSuppressionConfirmed).not.toHaveBeenCalled()
  })

  test('keeps a refresh-locked suppression draft editable while blocking confirmation and campaign activation', async () => {
    const refreshController = controller(candidate({ campaign: { ...candidate().campaign, status: 'draft' } }))
    refreshController.state.refresh_required = true
    refreshController.setSuppressionConfirmed = vi.fn(() => { throw new Error('refresh confirmation reached') })
    refreshController.setCampaignActivationConfirmed = vi.fn(() => { throw new Error('refresh activation reached') })
    testDoubles.useOutreachCandidatePage.mockReturnValue(refreshController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    const target = field(mounted, '[name="suppression_target"][value="product_domain"]')
    const reason = field(mounted, '[name="suppression_reason"]')
    const source = field(mounted, '[name="suppression_source"][value="opt_out"]')
    expect(target.attributes('disabled')).toBeUndefined()
    expect(reason.attributes('disabled')).toBeUndefined()
    expect(source.attributes('disabled')).toBeUndefined()
    await target.setValue(true)
    await reason.setValue('Reviewed public opt-out evidence')
    await source.setValue(true)
    expect(refreshController.setSuppressionTarget).toHaveBeenCalledWith('product_domain')
    expect(refreshController.setSuppressionReason).toHaveBeenCalledWith('Reviewed public opt-out evidence')
    expect(refreshController.setSuppressionSource).toHaveBeenCalledWith('opt_out')

    const confirmation = field(mounted, '[name="suppression_confirm"]')
    expect(confirmation.attributes('disabled')).toBeDefined()
    await confirmation.trigger('change')
    expect(refreshController.setSuppressionConfirmed).not.toHaveBeenCalled()
    const activation = button(mounted, 'Enable CSV export in LaunchLog')
    expect(activation.attributes('disabled')).toBeDefined()
    await activation.trigger('click')
    expect(refreshController.setCampaignActivationConfirmed).not.toHaveBeenCalled()
  })

  test.each([
    [ListPage, 'list'],
    [NewPage, 'new'],
    [DetailPage, 'detail'],
  ] as const)('removes private robots metadata when the %s page unmounts', async (component, kind) => {
    if (kind === 'detail') setDetailRoute()
    const mounted = await mountTaskComponent(component)
    await settle()
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex')

    mounted.unmount()
    await nextTick()

    const directives = [...document.head.querySelectorAll('meta[name="robots"]')]
      .flatMap(meta => (meta.getAttribute('content') ?? '').toLowerCase().split(','))
      .map(value => value.trim())
    expect(directives).not.toContain('noindex')
    expect(directives).not.toContain('nofollow')
  })

  test('locks the create surface after committed recovery cannot be reloaded', async () => {
    const recovery = {
      public_id: PUBLIC_ID,
      persistence_status: 'committed' as const,
      recovery_url: `/api/v1/admin/outreach/candidates/${PUBLIC_ID}`,
    }
    const client = api({
      createCandidate: vi.fn().mockResolvedValue(recovery),
      getCandidate: vi.fn().mockRejectedValue(new OutreachApiError('network')),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    testDoubles.validateCommittedRecovery.mockReturnValue(PUBLIC_ID)
    const mounted = await mountTaskComponent(NewPage)
    await settle()
    await completeCandidateForm(mounted)
    await field(mounted, 'form').trigger('submit')
    await settle()

    expect(mounted.text()).toContain('The candidate was saved')
    const create = mounted.findAll('button').find(item => item.text().trim() === 'Create candidate')
    expect(create === undefined || create.attributes('disabled') !== undefined).toBe(true)
    expect(client.createCandidate).toHaveBeenCalledOnce()
  })

  test('renders durable export timestamp and actor email fallback without exposing the hash', async () => {
    const detail = candidate({
      persisted_status: 'exported',
      effective_status: 'exported',
      audit: {
        approved_at: '2026-08-25T10:00:00.000Z',
        approved_by: { name: null, email: 'approver@example.invalid' },
        exported_at: '2026-08-26T09:15:00.000Z',
        exported_by: { name: null, email: 'exporter@example.invalid' },
        export_count: 2,
        last_export_hash: AUDIT_HASH,
      },
    })
    testDoubles.useOutreachCandidatePage.mockReturnValue(controller(detail))
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    expect(mounted.text()).toContain('2026-08-26T09:15:00.000Z')
    expect(mounted.text()).toContain('approver@example.invalid')
    expect(mounted.text()).toContain('exporter@example.invalid')
    expect(mounted.text()).not.toContain(AUDIT_HASH)
  })

  test('canonicalizes a valid domain alias and page one without passing aliases to the API', async () => {
    testDoubles.route.query = { domain: ' Product.Example.Invalid. ', page: '1' }
    const client = api()
    testDoubles.useAdminOutreach.mockReturnValue(client)
    await mountTaskComponent(ListPage)
    await settle()

    expect(client.listCandidates).toHaveBeenCalledOnce()
    expect(client.listCandidates).toHaveBeenCalledWith({ domain: 'product.example.invalid' }, expect.anything())
    expect(testDoubles.routerReplace).toHaveBeenCalledWith({ query: { domain: 'product.example.invalid' } })
  })

  test('wires campaign and suppression fields to stable descriptions, errors, and validity state', async () => {
    const list = await mountTaskComponent(ListPage)
    await settle()

    const describeContract = (wrapper: VueWrapper, selector: string) => {
      const control = field(wrapper, selector)
      expect(accessibleNameOf(wrapper, control)).toMatch(/\S/)
      expect(control.attributes('aria-invalid')).toBe('false')
      const describedBy = control.attributes('aria-describedby')?.split(/\s+/) ?? []
      expect(describedBy.every(Boolean)).toBe(true)
      expect(new Set(describedBy).size).toBeGreaterThanOrEqual(2)
      const nodes = describedBy.map((describedId) => {
        const describedNode = wrapper.find(`[id="${describedId}"]`)
        return describedNode.exists() ? describedNode.element : null
      })
      expect(nodes.every(node => node !== null && wrapper.element.contains(node))).toBe(true)
      expect(nodes.some(node => (node?.textContent ?? '').trim().length > 0)).toBe(true)
      expect(nodes.some(node => (
        (node?.textContent ?? '').trim().length === 0
        || node?.matches('[role="alert"], [role="status"], [aria-live]') === true
      ))).toBe(true)
      return { control, describedBy, nodes }
    }

    const listContracts = [
      ['[name="campaign_name"]', 'Accessible campaign'],
      ['[name="campaign_key"]', 'accessible-campaign'],
      ['[name="sender_identity_label"]', 'Founder research'],
      ['[name="domain"]', 'product.example.invalid'],
    ] as const
    const stableListContracts = listContracts.map(([selector, value]) => ({
      selector,
      value,
      ...describeContract(list, selector),
    }))

    for (const contract of stableListContracts) await contract.control.setValue(contract.value)
    await nextTick()
    for (const contract of stableListContracts) {
      const current = describeContract(list, contract.selector)
      expect(current.describedBy).toEqual(contract.describedBy)
      expect(current.nodes).toEqual(contract.nodes)
    }

    const detailController = controller()
    testDoubles.useOutreachCandidatePage.mockReturnValue(detailController)
    setDetailRoute()
    const detail = await mountTaskComponent(DetailPage)
    await settle()
    const suppression = describeContract(detail, '[name="suppression_reason"]')
    await suppression.control.setValue('Reviewed public request')
    await nextTick()
    const currentSuppression = describeContract(detail, '[name="suppression_reason"]')
    expect(currentSuppression.describedBy).toEqual(suppression.describedBy)
    expect(currentSuppression.nodes).toEqual(suppression.nodes)
  })

  test('announces create, activation, and archive campaign success through the stable live region', async () => {
    const created = campaign({ key: 'autumn-founders', name: 'Autumn founders', status: 'draft' })
    const client = api({
      listCampaigns: vi.fn().mockResolvedValue([campaign({ status: 'draft' })]),
      createCampaign: vi.fn().mockResolvedValue(created),
      updateCampaign: vi.fn()
        .mockResolvedValueOnce(campaign({ status: 'active' }))
        .mockResolvedValueOnce(campaign({ status: 'archived' })),
    })
    testDoubles.useAdminOutreach.mockReturnValue(client)
    const mounted = await mountTaskComponent(ListPage)
    await settle()
    const announcer = politeAnnouncer(mounted).element

    await field(mounted, '[name="campaign_name"]').setValue('Autumn founders')
    await field(mounted, '[name="campaign_key"]').setValue('autumn-founders')
    await field(mounted, '[name="sender_identity_label"]').setValue('Founder research')
    await button(mounted, 'Create campaign').trigger('click')
    await settle()
    expect(politeAnnouncer(mounted).element).toBe(announcer)
    expect(announcer.textContent).toMatch(/Autumn founders.*created/i)

    await button(mounted, 'Enable CSV export in LaunchLog').trigger('click')
    await button(mounted, 'Confirm CSV eligibility').trigger('click')
    await settle()
    expect(announcer.textContent).toMatch(/Founder signals.*(?:active|enabled)/i)

    await button(mounted, 'Archive campaign').trigger('click')
    await button(mounted, 'Confirm permanent archive').trigger('click')
    await settle()
    expect(announcer.textContent).toMatch(/Founder signals.*archived/i)
  })

  test('keeps the same-revision authoritative draft returned by discard refresh', async () => {
    const initial = candidate({
      revision: 7,
      draft: {
        subject_line: 'Initial clean subject',
        opening_line: 'Initial clean opening',
        email_body: 'Initial clean body',
      },
    })
    const authoritative = candidate({
      revision: 7,
      draft: {
        subject_line: 'Authoritative subject',
        opening_line: 'Authoritative opening',
        email_body: 'Authoritative body',
      },
    })
    const getCandidate = vi.fn().mockResolvedValue(authoritative)
    const candidateController = controller(initial)
    candidateController.confirmDiscardAndRefresh = vi.fn().mockImplementation(async () => {
      const refreshed = await getCandidate(PUBLIC_ID)
      candidateController.state.candidate = refreshed
      candidateController.state.draft_form = { ...refreshed.draft! }
      candidateController.state.draft_edit = 'clean'
      candidateController.state.discard_confirmation_required = false
    })
    testDoubles.useOutreachCandidatePage.mockReturnValue(candidateController)
    setDetailRoute()
    const mounted = await mountTaskComponent(DetailPage)
    await settle()

    const subject = field<HTMLInputElement>(mounted, '[name="subject_line"]')
    expect(subject.element.value).toBe('Initial clean subject')
    await subject.setValue('Unsaved local subject')
    expect(candidateController.state.draft_edit).toBe('dirty')
    await button(mounted, 'Refresh').trigger('click')
    await button(mounted, 'Discard and refresh').trigger('click')
    await settle()

    expect(getCandidate).toHaveBeenCalledOnce()
    expect(getCandidate).toHaveBeenCalledWith(PUBLIC_ID)
    expect(candidateController.confirmDiscardAndRefresh).toHaveBeenCalledOnce()
    expect(candidateController.load).toHaveBeenCalledOnce()
    expect(candidateController.state.candidate?.revision).toBe(7)
    expect(candidateController.state.draft_form.subject_line).toBe('Authoritative subject')
    expect(subject.element.value).toBe('Authoritative subject')
    expect(subject.element.value).not.toBe('Initial clean subject')
    expect(subject.element.value).not.toBe('Unsaved local subject')
  })
})
