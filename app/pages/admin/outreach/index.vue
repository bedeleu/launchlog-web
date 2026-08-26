<script setup lang="ts">
import { Archive, ArrowRight, Download, Plus, RefreshCw } from '@lucide/vue'
import type {
  OutreachApiError,
  OutreachCampaign,
  OutreachCandidateFilters,
  OutreachCandidatePage,
  OutreachCandidateSummary,
  OutreachEffectiveStatus,
} from '~/composables/useAdminOutreach'
import { outreachCampaignCreateSchema } from '~/utils/outreach-form-schema'

definePageMeta({ middleware: 'admin' })
const privatePageTitle = 'Outreach operations · LaunchLog'
const privateHeadMarker = 'outreach-list'
if (import.meta.server) {
  useHead({
    title: privatePageTitle,
    meta: [{ name: 'robots', content: 'noindex, nofollow', 'data-launchlog-private-head': privateHeadMarker }],
  })
}

const route = useRoute()
const router = useRouter()
const client = useAdminOutreach()

const statusOptions: Array<{ value: '' | OutreachEffectiveStatus, label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'preview_generating', label: 'Preview generating' },
  { value: 'ready_for_review', label: 'Ready for review' },
  { value: 'approved', label: 'Approved' },
  { value: 'exported', label: 'Exported' },
  { value: 'failed', label: 'Failed preview' },
  { value: 'expired', label: 'Expired' },
  { value: 'suppressed', label: 'Suppressed' },
  { value: 'converted', label: 'Converted' },
]
const validStatuses = new Set(statusOptions.slice(1).map(item => item.value))

const campaigns = ref<OutreachCampaign[]>([])
const campaignError = ref<string | null>(null)
const result = ref<OutreachCandidatePage | null>(null)
const listState = ref<'loading' | 'ready' | 'error'>('loading')
const listError = ref<string | null>(null)
const domainInput = ref('')
const selected = ref<string[]>([])
const confirmReexport = ref(false)
const refreshRequired = ref(false)
const downloadCompleted = ref(false)
const exportBusy = ref(false)
const actionError = ref<string | null>(null)
const campaignBusy = ref(false)
const campaignCreate = reactive({ name: '', key: '', sender_identity_label: '' })
const campaignFieldErrors = ref<Record<string, string>>({})
const createError = ref<string | null>(null)
const domainError = ref<string | null>(null)
const campaignAnnouncement = ref<string | null>(null)
const activationConfirmKey = ref<string | null>(null)
const archiveConfirmKey = ref<string | null>(null)
const mounted = ref(true)
let listEpoch = 0
let exportEpoch = 0
let listAbort: AbortController | null = null
let campaignAbort: AbortController | null = null
let actionAbort: AbortController | null = null
let exportAbort: AbortController | null = null
let resultIdentity: string | null = null
let canonicalWatchSkip: string | null = null
let previousDocumentTitle = ''
let privateRobotsMeta: HTMLMetaElement | null = null

const rows = computed(() => result.value?.data ?? [])
const selectedRows = computed(() => rows.value.filter(row => selected.value.includes(row.public_id)))
const selectedCampaign = computed(() => selectedRows.value[0]?.campaign_key ?? null)
const containsReexport = computed(() => selectedRows.value.some(row => row.export_count > 0))
const parsed = computed(() => parseRouteQuery(route.query as Record<string, unknown>))
const announcer = computed(() => {
  if (listState.value === 'loading') return 'Loading outreach candidates'
  if (listState.value === 'error') return 'Outreach candidates could not be loaded'
  if (exportBusy.value) return 'Downloading CSV'
  if (campaignAnnouncement.value) return campaignAnnouncement.value
  return `${rows.value.length} candidates loaded; ${selected.value.length} selected`
})

function safeError(error: unknown): string {
  const kind = (error as OutreachApiError | undefined)?.kind
  if (kind === 'network') return 'Could not reach LaunchLog. Check the connection and retry.'
  if (kind === 'conflict' || kind === 'stale_revision') return 'This changed since the last refresh. Refresh required before another action.'
  return 'LaunchLog could not complete this request. Review the current state and retry.'
}

function mountPrivateHead(): void {
  previousDocumentTitle = document.title
  document.title = privatePageTitle
  privateRobotsMeta = document.head.querySelector<HTMLMetaElement>(`meta[name="robots"][data-launchlog-private-head="${privateHeadMarker}"]`)
  if (privateRobotsMeta !== null) return
  privateRobotsMeta = document.createElement('meta')
  privateRobotsMeta.name = 'robots'
  privateRobotsMeta.content = 'noindex, nofollow'
  privateRobotsMeta.dataset.launchlogPrivateHead = privateHeadMarker
  document.head.appendChild(privateRobotsMeta)
}

function unmountPrivateHead(): void {
  privateRobotsMeta?.remove()
  privateRobotsMeta = null
  if (document.title === privatePageTitle) document.title = previousDocumentTitle
}

function firstQueryValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/\.+$/, '')
}

function queryIsCanonical(raw: Record<string, unknown>, canonical: Record<string, string>): boolean {
  const keys = Object.keys(raw)
  const canonicalKeys = Object.keys(canonical)
  return keys.length === canonicalKeys.length
    && canonicalKeys.every(key => typeof raw[key] === 'string' && raw[key] === canonical[key])
}

function querySignature(query: Record<string, string>): string {
  return JSON.stringify(Object.keys(query).sort().map(key => [key, query[key]]))
}

function validDomain(value: string): boolean {
  if (value.length > 253 || !value.includes('.')) return false
  return value.split('.').every(label => (
    label.length > 0
    && label.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  ))
}

function campaignFieldError(name: string): string | undefined {
  return campaignFieldErrors.value[name]
}

function parseRouteQuery(query: Record<string, unknown>): { filters: OutreachCandidateFilters, query: Record<string, string>, malformed: boolean } {
  const filters: OutreachCandidateFilters = {}
  const canonical: Record<string, string> = {}
  const allowedKeys = new Set(['status', 'campaign_key', 'domain', 'suppressed', 'page'])
  let malformed = Object.keys(query).some(key => !allowedKeys.has(key))
  const status = firstQueryValue(query.status)
  if (query.status !== undefined) {
    if (status && validStatuses.has(status as OutreachEffectiveStatus)) {
      filters.status = status as OutreachEffectiveStatus
      canonical.status = status
    }
    else malformed = true
  }
  const campaignKey = firstQueryValue(query.campaign_key)
  if (query.campaign_key !== undefined) {
    if (campaignKey && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(campaignKey) && Array.from(campaignKey).length <= 80) {
      filters.campaign_key = campaignKey
      canonical.campaign_key = campaignKey
    }
    else malformed = true
  }
  const domain = firstQueryValue(query.domain)
  if (query.domain !== undefined) {
    const normalized = domain === null ? '' : normalizeDomain(domain)
    if (domain !== null && normalized !== '' && Array.from(normalized).length <= 253) {
      filters.domain = normalized
      canonical.domain = normalized
    }
    else malformed = true
  }
  const suppressed = firstQueryValue(query.suppressed)
  if (query.suppressed !== undefined) {
    if (suppressed === '0' || suppressed === '1') {
      filters.suppressed = suppressed === '1'
      canonical.suppressed = suppressed
    }
    else malformed = true
  }
  const page = firstQueryValue(query.page)
  if (query.page !== undefined) {
    if (page && /^[1-9]\d*$/.test(page) && Number(page) <= 2_147_483_647 && String(Number(page)) === page) {
      const pageNumber = Number(page)
      if (pageNumber > 1) {
        filters.page = pageNumber
        canonical.page = page
      }
    }
    else malformed = true
  }
  return malformed ? { filters: {}, query: {}, malformed: true } : { filters, query: canonical, malformed: false }
}

function resetSelection(): void {
  selected.value = []
  confirmReexport.value = false
}

function identityOf(page: OutreachCandidatePage): string {
  return JSON.stringify(page.data.map(row => [
    row.public_id,
    row.campaign_key,
    row.campaign_status,
    row.persisted_status,
    row.effective_status,
    row.preview_status,
    row.approved_at,
    row.expires_at,
    row.export_count,
    row.revision,
  ]))
}

async function loadCandidates(options: { preserve?: boolean, clearRefreshOnSuccess?: boolean } = {}): Promise<boolean> {
  listAbort?.abort()
  const request = new AbortController()
  listAbort = request
  const epoch = ++listEpoch
  if (!options.preserve) {
    listState.value = 'loading'
    listError.value = null
  }
  const state = parsed.value
  const canonicalQuery = state.malformed ? {} : state.query
  if (state.malformed || !queryIsCanonical(route.query as Record<string, unknown>, canonicalQuery)) {
    canonicalWatchSkip = querySignature(canonicalQuery)
    void router.replace({ query: canonicalQuery })
  }
  try {
    const next = await client.listCandidates(state.filters, { signal: request.signal })
    if (!mounted.value || request.signal.aborted || epoch !== listEpoch) return false
    const nextIdentity = identityOf(next)
    if (resultIdentity !== null && nextIdentity !== resultIdentity) resetSelection()
    resultIdentity = nextIdentity
    result.value = next
    const eligibleIds = new Set(next.data.filter(isSummaryCsvSelectable).map(row => row.public_id))
    if (selected.value.some(id => !eligibleIds.has(id))) resetSelection()
    domainInput.value = state.query.domain ?? ''
    listState.value = 'ready'
    listError.value = null
    if (options.clearRefreshOnSuccess) {
      refreshRequired.value = false
      actionError.value = null
    }
    return true
  }
  catch (error) {
    if (!mounted.value || request.signal.aborted || epoch !== listEpoch) return false
    if (!options.preserve) {
      listState.value = 'error'
      listError.value = safeError(error)
    }
    return false
  }
}

async function loadCampaigns(): Promise<void> {
  campaignAbort?.abort()
  const request = new AbortController()
  campaignAbort = request
  try {
    const next = await client.listCampaigns({ signal: request.signal })
    if (mounted.value && !request.signal.aborted && campaignAbort === request) campaigns.value = next
  }
  catch (error) {
    if (mounted.value && !request.signal.aborted && campaignAbort === request) campaignError.value = safeError(error)
  }
}

function nextQuery(patch: Record<string, string | undefined>, resetPage = true): Record<string, string> {
  const query = { ...parsed.value.query }
  if ('status' in patch) {
    if (patch.status) query.status = patch.status
    else Reflect.deleteProperty(query, 'status')
  }
  if ('campaign_key' in patch) {
    if (patch.campaign_key) query.campaign_key = patch.campaign_key
    else Reflect.deleteProperty(query, 'campaign_key')
  }
  if ('domain' in patch) {
    if (patch.domain) query.domain = patch.domain
    else Reflect.deleteProperty(query, 'domain')
  }
  if ('suppressed' in patch) {
    if (patch.suppressed) query.suppressed = patch.suppressed
    else Reflect.deleteProperty(query, 'suppressed')
  }
  if ('page' in patch) {
    if (patch.page) query.page = patch.page
    else Reflect.deleteProperty(query, 'page')
  }
  if (resetPage) delete query.page
  return query
}

function updateFilter(patch: Record<string, string | undefined>): void {
  resetSelection()
  void router.replace({ query: nextQuery(patch) })
}

function applyDomain(): void {
  const normalized = normalizeDomain(domainInput.value)
  if (normalized !== '' && !validDomain(normalized)) {
    domainError.value = 'Enter a valid public domain.'
    return
  }
  domainError.value = null
  updateFilter({ domain: normalized || undefined })
}

function goToPage(page: number): void {
  resetSelection()
  void router.replace({ query: nextQuery({ page: page > 1 ? String(page) : undefined }, false) })
}

function isSummaryCsvSelectable(row: OutreachCandidateSummary): boolean {
  const expiry = row.expires_at === null ? Number.NaN : Date.parse(row.expires_at)
  return row.campaign_status === 'active'
    && (row.persisted_status === 'approved' || row.persisted_status === 'exported')
    && (row.effective_status === 'approved' || row.effective_status === 'exported')
    && row.approved_at !== null
    && row.preview_status === 'ready'
    && Number.isFinite(expiry)
    && expiry - Date.now() >= 24 * 60 * 60 * 1000
}

function selectionDisabled(row: OutreachCandidateSummary): boolean {
  if (!isSummaryCsvSelectable(row)) return true
  if (selected.value.includes(row.public_id)) return false
  if (selected.value.length >= 30) return true
  return selectedCampaign.value !== null && selectedCampaign.value !== row.campaign_key
}

function toggleSelection(row: OutreachCandidateSummary, checked: boolean): void {
  if (checked) {
    if (selectionDisabled(row)) return
    selected.value = [...selected.value, row.public_id]
  }
  else selected.value = selected.value.filter(id => id !== row.public_id)
  if (!containsReexport.value) confirmReexport.value = false
}

async function mutateCampaign(key: string, status: 'active' | 'archived'): Promise<void> {
  if (campaignBusy.value) return
  campaignBusy.value = true
  actionError.value = null
  actionAbort?.abort()
  const request = new AbortController()
  actionAbort = request
  try {
    const updated = await client.updateCampaign(key, { status }, { signal: request.signal })
    if (!mounted.value || request.signal.aborted || actionAbort !== request) return
    campaigns.value = campaigns.value.map(item => item.key === key ? updated : item)
    activationConfirmKey.value = null
    archiveConfirmKey.value = null
    resetSelection()
    campaignAnnouncement.value = status === 'active'
      ? `${updated.name} is active for LaunchLog CSV export`
      : `${updated.name} archived`
    const refreshed = await loadCandidates({ preserve: true })
    if (!refreshed && mounted.value && actionAbort === request) {
      refreshRequired.value = true
      actionError.value = 'Campaign updated. Refresh required before another CSV action.'
    }
  }
  catch (error) {
    if (mounted.value && !request.signal.aborted && actionAbort === request) actionError.value = safeError(error)
  }
  finally {
    if (mounted.value && actionAbort === request) campaignBusy.value = false
  }
}

async function createCampaign(): Promise<void> {
  if (campaignBusy.value) return
  createError.value = null
  campaignFieldErrors.value = {}
  const parsedCampaign = outreachCampaignCreateSchema.safeParse(campaignCreate)
  if (!parsedCampaign.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsedCampaign.error.issues) {
      const field = String(issue.path[0] ?? '')
      if (field && fieldErrors[field] === undefined) fieldErrors[field] = issue.message
    }
    campaignFieldErrors.value = fieldErrors
    createError.value = 'Check the campaign name, canonical key, and sender identity label.'
    return
  }
  campaignBusy.value = true
  actionAbort?.abort()
  const request = new AbortController()
  actionAbort = request
  try {
    const created = await client.createCampaign(parsedCampaign.data, { signal: request.signal })
    if (!mounted.value || request.signal.aborted || actionAbort !== request) return
    campaigns.value = [...campaigns.value, created]
    campaignAnnouncement.value = `${created.name} created`
    campaignCreate.name = ''
    campaignCreate.key = ''
    campaignCreate.sender_identity_label = ''
  }
  catch (error) {
    if (mounted.value && !request.signal.aborted && actionAbort === request) {
      const outreachError = error as OutreachApiError
      campaignFieldErrors.value = Object.fromEntries(
        Object.entries(outreachError.fieldErrors ?? {}).map(([field, messages]) => [field, messages[0] ?? 'Check this field.']),
      )
      createError.value = safeError(error)
    }
  }
  finally {
    if (mounted.value && actionAbort === request) campaignBusy.value = false
  }
}

function sanitizeFilename(filename: string): string {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, '-').trim()
  return safe || 'launchlog-outreach.csv'
}

async function downloadCsv(): Promise<void> {
  if (exportBusy.value || refreshRequired.value || selectedRows.value.length === 0) return
  const chosen = [...selectedRows.value]
  const campaignKey = chosen[0]?.campaign_key
  const needsReexport = chosen.some(row => row.export_count > 0)
  if (
    chosen.length !== selected.value.length
    || chosen.length > 30
    || !campaignKey
    || chosen.some(row => row.campaign_key !== campaignKey || !isSummaryCsvSelectable(row))
    || (needsReexport && !confirmReexport.value)
  ) {
    resetSelection()
    actionError.value = 'Candidate eligibility changed. Review the authoritative list before exporting.'
    return
  }
  const epoch = ++exportEpoch
  const request = new AbortController()
  exportAbort = request
  exportBusy.value = true
  actionError.value = null
  downloadCompleted.value = false
  let clickCompleted = false
  try {
    const download = await client.exportCandidates({
      campaign_key: campaignKey,
      prospect_public_ids: chosen.map(row => row.public_id),
      confirm_reexport: needsReexport ? confirmReexport.value : false,
    }, { signal: request.signal })
    if (!mounted.value || epoch !== exportEpoch) return

    const objectUrl = URL.createObjectURL(download.blob)
    const anchor = document.createElement('a')
    try {
      anchor.href = objectUrl
      anchor.download = sanitizeFilename(download.filename)
      document.body.appendChild(anchor)
      anchor.click()
      clickCompleted = true
      if (mounted.value && epoch === exportEpoch) {
        resetSelection()
        downloadCompleted.value = true
      }
    }
    catch {
      if (mounted.value && epoch === exportEpoch) actionError.value = 'The browser did not complete the download. Review the refreshed export audit before trying again.'
    }
    finally {
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    }

    if (!mounted.value || epoch !== exportEpoch) return
    const refreshed = await loadCandidates({ preserve: true })
    if (!mounted.value || epoch !== exportEpoch) return
    if (!refreshed) {
      refreshRequired.value = true
      actionError.value = clickCompleted
        ? 'Download completed. Refresh required to load the authoritative export audit.'
        : 'The browser did not complete the download and the audit could not be reloaded. Refresh required before another CSV action.'
    }
  }
  catch (error) {
    if (!mounted.value || epoch !== exportEpoch) return
    refreshRequired.value = true
    actionError.value = `${safeError(error)} Refresh required before another CSV action.`
  }
  finally {
    if (mounted.value && epoch === exportEpoch) exportBusy.value = false
  }
}

watch(() => JSON.stringify(route.query), () => {
  const routeState = parseRouteQuery(route.query as Record<string, unknown>)
  const canonicalQuery = routeState.malformed ? {} : routeState.query
  const canonicalSignature = querySignature(canonicalQuery)
  if (
    canonicalWatchSkip === canonicalSignature
    && !routeState.malformed
    && queryIsCanonical(route.query as Record<string, unknown>, canonicalQuery)
  ) {
    canonicalWatchSkip = null
    return
  }
  canonicalWatchSkip = null
  exportEpoch += 1
  exportAbort?.abort()
  exportBusy.value = false
  resetSelection()
  downloadCompleted.value = false
  void loadCandidates({ clearRefreshOnSuccess: true })
}, { immediate: true })
onMounted(() => {
  mountPrivateHead()
  void loadCampaigns()
})
onBeforeUnmount(() => {
  unmountPrivateHead()
  mounted.value = false
  listEpoch += 1
  exportEpoch += 1
  listAbort?.abort()
  campaignAbort?.abort()
  actionAbort?.abort()
  exportAbort?.abort()
})
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ announcer }}</p>

    <div class="flex flex-col gap-6 border-b border-brand-border pb-7 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-300">Private operations</p>
        <h1 class="mt-3 text-3xl font-semibold tracking-tight text-brand-fg sm:text-4xl">Outreach workspace</h1>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-brand-muted">Review public evidence, approve plain-text drafts, and download controlled CSV batches.</p>
      </div>
      <NuxtLink to="/admin/outreach/new" class="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-white outline-none transition hover:bg-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-50">
        <Plus class="size-4" /> New candidate
      </NuxtLink>
    </div>

    <section class="mt-8 rounded-2xl border border-brand-border bg-white/[0.03] p-5">
      <div class="flex items-center justify-between gap-3">
        <div><p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">Campaigns</p><h2 class="mt-1 text-lg font-semibold text-brand-fg">Internal CSV eligibility</h2></div>
      </div>
      <p v-if="campaignError" role="alert" class="mt-4 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{{ campaignError }}</p>
      <p v-if="actionError" role="alert" class="mt-4 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{{ actionError }}</p>
      <div class="mt-4 grid gap-3 lg:grid-cols-3">
        <article v-for="campaign in campaigns" :key="campaign.key" :data-campaign-key="campaign.key" class="rounded-xl border border-white/10 bg-black/20 p-4">
          <div class="flex items-start justify-between gap-3"><div><h3 class="font-medium text-brand-fg">{{ campaign.name }}</h3><p class="mt-1 text-xs text-brand-muted">{{ campaign.sender_identity_label }} · {{ campaign.candidate_count }} candidates</p></div><span class="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-muted">{{ campaign.status === 'archived' ? 'Archived' : campaign.status }}</span></div>
          <div v-if="campaign.status !== 'archived'" class="mt-4 flex flex-wrap gap-2">
            <button v-if="campaign.status === 'draft' && activationConfirmKey !== campaign.key" type="button" :disabled="campaignBusy" class="rounded-md border border-indigo-300/30 px-3 py-2 text-xs font-medium text-indigo-200 outline-none hover:bg-indigo-300/10 focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-45" @click="activationConfirmKey = campaign.key">Enable CSV export in LaunchLog</button>
            <template v-if="activationConfirmKey === campaign.key">
              <p class="w-full text-xs leading-5 text-amber-100">This enables LaunchLog CSV export only. It does not perform an external action.</p>
              <button type="button" :disabled="campaignBusy" class="rounded-md bg-indigo-500 px-3 py-2 text-xs font-semibold text-white outline-none hover:bg-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-45" @click="mutateCampaign(campaign.key, 'active')">{{ campaignBusy ? 'Enabling CSV export…' : 'Confirm CSV eligibility' }}</button>
            </template>
            <button v-if="archiveConfirmKey !== campaign.key" type="button" :disabled="campaignBusy" class="rounded-md border border-red-300/30 px-3 py-2 text-xs font-medium text-red-200 outline-none hover:bg-red-300/10 focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-45" @click="archiveConfirmKey = campaign.key"><Archive class="mr-1 inline size-3" />Archive campaign</button>
            <template v-else>
              <p class="w-full text-xs leading-5 text-red-200">Archiving is permanent in this workspace and blocks future candidate mutations.</p>
              <button type="button" :disabled="campaignBusy" class="rounded-md bg-red-500 px-3 py-2 text-xs font-semibold text-white outline-none hover:bg-red-400 focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-45" @click="mutateCampaign(campaign.key, 'archived')">Confirm permanent archive</button>
            </template>
          </div>
        </article>
      </div>

      <form class="mt-5 grid gap-3 border-t border-brand-border pt-5 md:grid-cols-[1fr_1fr_1fr_auto]" @submit.prevent="createCampaign">
        <div>
          <label for="campaign_name" class="text-xs text-brand-muted">Campaign name</label>
          <input id="campaign_name" v-model="campaignCreate.name" name="campaign_name" :disabled="campaignBusy" :aria-invalid="campaignFieldError('name') ? 'true' : 'false'" aria-describedby="campaign-name-description campaign-name-error" class="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-brand-fg outline-none focus-visible:border-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent/30 disabled:opacity-45 aria-[invalid=true]:border-red-400">
          <p id="campaign-name-description" class="mt-1 min-h-5 text-xs leading-5 text-brand-muted">Internal label shown to reviewers.</p>
          <p id="campaign-name-error" :role="campaignFieldError('name') ? 'alert' : 'status'" class="min-h-5 text-xs leading-5 text-red-300">{{ campaignFieldError('name') }}</p>
        </div>
        <div>
          <label for="campaign_key" class="text-xs text-brand-muted">Canonical key</label>
          <input id="campaign_key" v-model="campaignCreate.key" name="campaign_key" :disabled="campaignBusy" :aria-invalid="campaignFieldError('key') ? 'true' : 'false'" aria-describedby="campaign-key-description campaign-key-error" class="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 font-mono text-sm text-brand-fg outline-none focus-visible:border-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent/30 disabled:opacity-45 aria-[invalid=true]:border-red-400">
          <p id="campaign-key-description" class="mt-1 min-h-5 text-xs leading-5 text-brand-muted">Lowercase letters, numbers, and hyphens.</p>
          <p id="campaign-key-error" :role="campaignFieldError('key') ? 'alert' : 'status'" class="min-h-5 text-xs leading-5 text-red-300">{{ campaignFieldError('key') }}</p>
        </div>
        <div>
          <label for="sender_identity_label" class="text-xs text-brand-muted">Sender identity label</label>
          <input id="sender_identity_label" v-model="campaignCreate.sender_identity_label" name="sender_identity_label" :disabled="campaignBusy" :aria-invalid="campaignFieldError('sender_identity_label') ? 'true' : 'false'" aria-describedby="campaign-sender-description campaign-sender-error" class="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-brand-fg outline-none focus-visible:border-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent/30 disabled:opacity-45 aria-[invalid=true]:border-red-400">
          <p id="campaign-sender-description" class="mt-1 min-h-5 text-xs leading-5 text-brand-muted">Human-readable internal sender identity.</p>
          <p id="campaign-sender-error" :role="campaignFieldError('sender_identity_label') ? 'alert' : 'status'" class="min-h-5 text-xs leading-5 text-red-300">{{ campaignFieldError('sender_identity_label') }}</p>
        </div>
        <button type="button" :disabled="campaignBusy" class="mt-auto h-10 rounded-lg border border-white/15 px-4 text-sm font-medium text-brand-fg outline-none hover:border-indigo-300/50 hover:text-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-45" @click="createCampaign">{{ campaignBusy ? 'Creating campaign…' : 'Create campaign' }}</button>
        <p v-if="createError" role="alert" class="text-sm text-red-200 md:col-span-4">{{ createError }}</p>
      </form>
    </section>

    <section class="mt-6 rounded-2xl border border-brand-border bg-white/[0.03] p-5">
      <div class="flex flex-wrap gap-2">
        <button v-for="status in statusOptions" :key="status.value" type="button" :data-status="status.value" :aria-pressed="(parsed.query.status ?? '') === status.value" class="rounded-full border px-3 py-1.5 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-300" :class="(parsed.query.status ?? '') === status.value ? 'border-indigo-400/60 bg-indigo-400/15 text-indigo-100' : 'border-white/10 text-brand-muted hover:border-white/20 hover:text-brand-fg'" @click="updateFilter({ status: status.value || undefined })">{{ status.label }}</button>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" data-campaign-filter="" :aria-pressed="!parsed.query.campaign_key" class="rounded-full border px-3 py-1.5 text-xs outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-300" :class="!parsed.query.campaign_key ? 'border-indigo-400/60 bg-indigo-400/15 text-indigo-100' : 'border-white/10 text-brand-muted hover:text-brand-fg'" @click="updateFilter({ campaign_key: undefined })">All campaigns</button>
        <button v-for="campaign in campaigns" :key="campaign.key" type="button" :data-campaign-filter="campaign.key" :aria-pressed="parsed.query.campaign_key === campaign.key" class="rounded-full border px-3 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-indigo-300" :class="parsed.query.campaign_key === campaign.key ? 'border-indigo-400/60 bg-indigo-400/15 text-indigo-100' : 'border-white/10 text-brand-muted hover:text-brand-fg'" @click="updateFilter({ campaign_key: campaign.key })">{{ campaign.name }}</button>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button v-for="option in [{ value: undefined, label: 'All suppressions' }, { value: '0', label: 'Not suppressed' }, { value: '1', label: 'Suppressed only' }]" :key="option.label" type="button" :aria-pressed="parsed.query.suppressed === option.value || (option.value === undefined && !parsed.query.suppressed)" class="rounded-full border px-3 py-1.5 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-300" :class="parsed.query.suppressed === option.value || (option.value === undefined && !parsed.query.suppressed) ? 'border-indigo-300/70 bg-indigo-400/20 text-indigo-50 shadow-[inset_0_0_0_1px_rgba(129,140,248,0.18)]' : 'border-white/10 bg-transparent text-brand-muted hover:border-white/20 hover:text-brand-fg'" @click="updateFilter({ suppressed: option.value })">{{ option.label }}</button>
      </div>
      <form class="mt-4 max-w-xl" @submit.prevent="applyDomain">
        <label for="domain" class="text-xs font-medium text-brand-muted">Submitted domain</label>
        <div class="mt-1.5 flex gap-2">
          <input id="domain" v-model="domainInput" name="domain" placeholder="product.example.com" :aria-invalid="domainError ? 'true' : 'false'" aria-describedby="domain-description domain-error" class="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-brand-fg outline-none placeholder:text-brand-muted/50 focus-visible:border-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent/30 aria-[invalid=true]:border-red-400">
          <button type="button" class="rounded-lg border border-white/15 px-4 text-sm font-medium text-brand-fg outline-none hover:border-indigo-300/50 focus-visible:ring-2 focus-visible:ring-indigo-300" @click="applyDomain">Apply domain</button>
        </div>
        <p id="domain-description" class="mt-1 min-h-5 text-xs leading-5 text-brand-muted">Filter by the normalized submitted product domain.</p>
        <p id="domain-error" :role="domainError ? 'alert' : 'status'" class="min-h-5 text-xs leading-5 text-red-300">{{ domainError }}</p>
      </form>
    </section>

    <section class="mt-6 overflow-hidden rounded-2xl border border-brand-border bg-white/[0.03]">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border px-5 py-4">
        <div><h2 class="font-semibold text-brand-fg">Candidates</h2><p class="mt-1 text-xs text-brand-muted">{{ selected.length }} selected · maximum 30 from one campaign</p></div>
        <div class="flex items-center gap-2"><button type="button" class="rounded-lg border border-white/15 p-2 text-brand-muted outline-none hover:text-brand-fg focus-visible:ring-2 focus-visible:ring-indigo-300" aria-label="Refresh candidate list" @click="loadCandidates({ clearRefreshOnSuccess: true })"><RefreshCw class="size-4" /></button><button type="button" :disabled="selected.length === 0 || exportBusy || refreshRequired || (containsReexport && !confirmReexport)" class="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-slate-950 outline-none hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-40" @click="downloadCsv"><Download class="size-4" />{{ exportBusy ? 'Downloading CSV…' : 'Download CSV' }}</button></div>
      </div>

      <div v-if="containsReexport" class="border-b border-amber-300/20 bg-amber-300/10 px-5 py-4 text-sm text-amber-100">
        <p>Some selected candidates were exported before. Every further export requires confirmation.</p>
        <label for="confirm_reexport" class="mt-3 inline-flex cursor-pointer items-center gap-3 rounded-lg outline-none focus-within:ring-2 focus-within:ring-amber-200">
          <input id="confirm_reexport" v-model="confirmReexport" name="confirm_reexport" type="checkbox" class="peer sr-only">
          <span aria-hidden="true" class="relative size-5 shrink-0 rounded-md border border-amber-200/40 bg-black/35 transition after:absolute after:left-[6px] after:top-[2px] after:h-3 after:w-1.5 after:rotate-45 after:border-b-2 after:border-r-2 after:border-slate-950 after:opacity-0 peer-checked:border-amber-300 peer-checked:bg-amber-300 peer-checked:after:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-200 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#2a2415]" />
          <span>I reviewed the export history and confirm this re-export</span>
        </label>
      </div>
      <p v-if="downloadCompleted" class="border-b border-emerald-300/20 bg-emerald-300/10 px-5 py-3 text-sm text-emerald-100">Download completed.</p>
      <p v-if="refreshRequired" class="border-b border-amber-300/20 bg-amber-300/10 px-5 py-3 text-sm text-amber-100">Refresh required before another CSV action.</p>

      <div v-if="listState === 'loading'" class="p-12 text-center"><AppSpinner label="Loading outreach candidates" /><p class="mt-3 text-sm text-brand-muted">Loading outreach candidates</p></div>
      <div v-else-if="listState === 'error'" class="p-8"><p role="alert" class="text-sm text-red-200">{{ listError }}</p><button type="button" class="mt-4 rounded-lg border border-red-300/30 px-4 py-2 text-sm text-red-100 outline-none hover:bg-red-300/10 focus-visible:ring-2 focus-visible:ring-red-300" @click="loadCandidates({ clearRefreshOnSuccess: true })">Retry</button></div>
      <div v-else-if="rows.length === 0" class="p-12 text-center text-sm text-brand-muted">No candidates match these filters</div>
      <div v-else class="overflow-hidden">
        <table class="block w-full text-left text-sm md:table md:min-w-[900px]">
          <thead class="hidden bg-black/20 text-xs uppercase tracking-[0.14em] text-brand-muted md:table-header-group"><tr><th class="px-4 py-3">Choose</th><th class="px-4 py-3">Candidate</th><th class="px-4 py-3">Campaign</th><th class="px-4 py-3">State</th><th class="px-4 py-3">Audit</th><th class="px-4 py-3">Review</th></tr></thead>
          <tbody class="block divide-y divide-brand-border md:table-row-group">
            <tr v-for="row in rows" :key="row.public_id" class="grid min-w-0 gap-x-5 gap-y-4 p-4 transition hover:bg-white/[0.025] sm:grid-cols-2 md:table-row md:p-0">
              <td class="flex min-w-0 items-center md:table-cell md:px-4 md:py-4">
                <label :for="`select-${row.public_id}`" class="inline-flex cursor-pointer items-center gap-3 rounded-md text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted focus-within:ring-2 focus-within:ring-indigo-300">
                  <input :id="`select-${row.public_id}`" type="checkbox" :checked="selected.includes(row.public_id)" :disabled="selectionDisabled(row)" class="peer sr-only" @change="toggleSelection(row, ($event.target as HTMLInputElement).checked)">
                  <span aria-hidden="true" class="relative size-5 shrink-0 rounded-md border border-white/25 bg-black/40 shadow-inner shadow-black/30 transition after:absolute after:left-[6px] after:top-[2px] after:h-3 after:w-1.5 after:rotate-45 after:border-b-2 after:border-r-2 after:border-white after:opacity-0 peer-checked:border-indigo-300 peer-checked:bg-indigo-500 peer-checked:after:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#0a0e1a] peer-disabled:cursor-not-allowed peer-disabled:opacity-30" />
                  <span class="md:sr-only">Select {{ row.company_name }} for CSV</span>
                </label>
              </td>
              <td class="min-w-0 md:table-cell md:px-4 md:py-4"><p class="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-muted md:hidden">Candidate</p><p class="break-words font-medium text-brand-fg">{{ row.company_name }}</p><p class="mt-1 break-words text-brand-muted">{{ row.product_name }} · {{ row.normalized_domain }}</p><p class="mt-1 break-all font-mono text-xs text-brand-muted">{{ row.business_email_masked }}</p></td>
              <td class="min-w-0 text-brand-muted md:table-cell md:px-4 md:py-4"><p class="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-muted md:hidden">Campaign</p><span class="break-all">{{ row.campaign_key }}</span><span class="mt-1 block text-xs">{{ row.campaign_status }}</span></td>
              <td class="min-w-0 md:table-cell md:px-4 md:py-4"><p class="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-muted md:hidden">State</p><span :data-status="row.effective_status" class="inline-flex max-w-full rounded-full border border-white/10 px-2 py-1 text-xs text-brand-fg">{{ row.effective_status.replaceAll('_', ' ') }}</span><p class="mt-2 text-xs text-brand-muted">Persisted {{ row.persisted_status.replaceAll('_', ' ') }}</p></td>
              <td class="min-w-0 text-xs text-brand-muted md:table-cell md:px-4 md:py-4"><p class="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] md:hidden">Audit</p><p>Revision {{ row.revision }}</p><p class="mt-1">{{ row.export_count ? `Exported ${row.export_count} times` : row.approved_at ? 'Approved' : 'Not approved' }}</p><p class="mt-1 break-words">Expires {{ row.expires_at ?? 'not available' }}</p></td>
              <td class="min-w-0 sm:col-span-2 md:table-cell md:px-4 md:py-4"><span class="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-muted md:hidden">Review</span><NuxtLink :to="`/admin/outreach/${row.public_id}`" :aria-label="`Open ${row.company_name} outreach candidate`" class="inline-flex items-center gap-1 rounded-md text-sm font-medium text-indigo-300 outline-none hover:text-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-300">Open <ArrowRight class="size-4" /></NuxtLink></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="result" class="flex items-center justify-between border-t border-brand-border px-5 py-4"><button type="button" :disabled="!result.links.prev" class="rounded-md border border-white/10 px-3 py-2 text-xs text-brand-muted outline-none hover:text-brand-fg focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-35" @click="goToPage(result.meta.current_page - 1)">Previous page</button><p class="text-xs text-brand-muted">Page {{ result.meta.current_page }} of {{ result.meta.last_page }}</p><button type="button" :disabled="!result.links.next" class="rounded-md border border-white/10 px-3 py-2 text-xs text-brand-muted outline-none hover:text-brand-fg focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-35" @click="goToPage(result.meta.current_page + 1)">Next page</button></div>
    </section>
  </div>
</template>
