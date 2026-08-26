<script setup lang="ts">
import { ArrowLeft, Download, ExternalLink, RefreshCw, ShieldAlert } from '@lucide/vue'
import type { OutreachApiError, OutreachSuppressionSource } from '~/composables/useAdminOutreach'
import type { OutreachDraftForm, OutreachProspectForm } from '~/composables/useOutreachCandidatePage'
import { safeExternalHttpUrl } from '~/utils/safe-public-url'

definePageMeta({
  middleware: 'admin',
  key: route => route.fullPath.split(/[?#]/, 1)[0] ?? route.fullPath,
})
const privatePageTitle = 'Outreach candidate review · LaunchLog'
const privateHeadMarker = 'outreach-detail'
if (import.meta.server) {
  useHead({
    title: privatePageTitle,
    meta: [{ name: 'robots', content: 'noindex, nofollow', 'data-launchlog-private-head': privateHeadMarker }],
  })
}
const route = useRoute()
const routeParam = route.params.publicId
const rawPath = route.fullPath.split(/[?#]/, 1)[0] ?? route.fullPath
const rawSegment = rawPath.split('/').at(-1) ?? ''
const boundaryValid = typeof routeParam === 'string' && rawSegment === routeParam
const publicId = boundaryValid ? routeParam : null
const controller = publicId === null ? null : useOutreachCandidatePage(publicId)
const state = controller?.state ?? null
const pageDisposed = ref(false)
const activationOpen = ref(false)
const downloadError = ref<string | null>(null)
const downloadSuccess = ref(false)
let previousDocumentTitle = ''
let privateRobotsMeta: HTMLMetaElement | null = null

const candidate = computed(() => state?.candidate ?? null)
const pending = computed(() => state?.action.phase === 'pending')
const invalidIdentifier = computed(() => !boundaryValid || (state?.load === 'load_error' && state.load_error?.kind === 'validation'))
const pageAnnouncer = computed(() => {
  if (invalidIdentifier.value) return 'Invalid candidate identifier'
  if (!state || state.load === 'idle') return 'Preparing candidate workspace'
  if (state.load === 'loading') return 'Loading outreach candidate'
  if (state.load === 'load_error') return 'Candidate could not be loaded'
  if (pending.value) return 'Working on candidate action'
  return `Candidate revision ${state.candidate?.revision ?? 0} loaded`
})

const placement = computed(() => ({
  domain: candidate.value?.preview?.normalized_domain || candidate.value?.prospect.normalized_domain || '',
  screenshot_url: candidate.value?.preview?.screenshot_url ?? null,
}))
const placementTitle = computed(() => candidate.value?.preview?.title || candidate.value?.prospect.product_name || '')
const placementTagline = computed(() => candidate.value?.preview?.tagline || '')
const generating = computed(() => candidate.value?.effective_status === 'preview_generating' || candidate.value?.preview?.status === 'generating')
const terminalLocked = computed(() => candidate.value?.campaign.status === 'archived'
  || candidate.value?.effective_status === 'converted'
  || candidate.value?.effective_status === 'suppressed')
const revisionLocked = computed(() => pending.value
  || state?.refresh_required === true
  || state?.prospect_edit === 'stale'
  || state?.draft_edit === 'stale'
  || terminalLocked.value)
const prospectInputLocked = computed(() => revisionLocked.value || state?.prospect_edit === 'stale')
const draftInputLocked = computed(() => revisionLocked.value || state?.draft_edit === 'stale')
const suppressionDraftLocked = computed(() => pending.value)
const suppressionConfirmationLocked = computed(() => pending.value
  || state?.refresh_required === true
  || state?.prospect_edit === 'stale'
  || state?.draft_edit === 'stale')
const activationLocked = computed(() => suppressionConfirmationLocked.value)
const canSaveProspect = computed(() => !revisionLocked.value && state?.prospect_edit === 'dirty')
const canSaveDraft = computed(() => !revisionLocked.value && state?.draft_edit === 'dirty')
const canApprove = computed(() => state?.view.blockers.approve.length === 0)
const canRecapture = computed(() => state?.view.blockers.recapture.length === 0)
const canRenew = computed(() => state?.view.blockers.renew.length === 0)
const canExport = computed(() => state?.view.blockers.export.length === 0)
const canSuppress = computed(() => state?.view.blockers.suppress.length === 0)
const exportCount = computed(() => candidate.value?.audit.export_count ?? 0)
const validationErrors = computed(() => state?.validation_errors ?? {})
const effectiveDomainAvailable = computed(() => Boolean(candidate.value?.preview?.normalized_domain))
const evidenceUrl = computed(() => safeExternalHttpUrl(candidate.value?.prospect.source_url))
const privatePlacementUrl = computed(() => safeExternalHttpUrl(candidate.value?.preview?.preview_url))
const suppressionReasonError = computed(() => firstError('reason') ?? firstError('suppression_reason'))

const inputClass = 'h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-brand-fg outline-none transition hover:border-white/20 focus-visible:border-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent/30 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-red-400'

function safeError(error: OutreachApiError | null): string | null {
  if (!error) return null
  if (error.kind === 'network') return 'Could not reach LaunchLog. Last good candidate data remains visible.'
  if (error.kind === 'validation') return 'Check this field.'
  if (error.kind === 'stale_revision' || error.kind === 'conflict') return 'This candidate changed. Refresh required before another revision-bound action.'
  if (error.kind === 'not_found') return 'This outreach candidate is no longer available.'
  return 'LaunchLog could not complete this request. Review the current state before retrying.'
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

function describeIds(name: string): string {
  return `${name}-description ${name}-error`
}

function firstError(name: string): string | undefined {
  return validationErrors.value[name]?.[0]
}

async function invoke(action: (() => Promise<unknown>) | undefined): Promise<void> {
  if (!action) return
  try { await action() }
  catch { /* The accepted controller exposes the safe reactive error boundary. */ }
}

async function discardAndRefresh(): Promise<void> {
  await invoke(controller?.confirmDiscardAndRefresh)
}

function invokeSetter(action: (() => void) | undefined): void {
  try { action?.() }
  catch { /* Freshness can change between render and the native event. */ }
}

function setProspect(field: keyof OutreachProspectForm, event: Event): void {
  if (prospectInputLocked.value) return
  invokeSetter(() => controller?.setProspectField(field, (event.target as HTMLInputElement | HTMLTextAreaElement).value))
}

function setDraft(field: keyof OutreachDraftForm, event: Event): void {
  if (draftInputLocked.value) return
  invokeSetter(() => controller?.setDraftField(field, (event.target as HTMLInputElement | HTMLTextAreaElement).value))
}

function disposePageController(): void {
  if (!controller || pageDisposed.value) return
  pageDisposed.value = true
  controller.dispose()
}

async function downloadCsv(): Promise<void> {
  if (!controller || !canExport.value) return
  downloadError.value = null
  downloadSuccess.value = false
  let objectUrl: string | null = null
  let anchor: HTMLAnchorElement | null = null
  try {
    const result = await controller.exportCandidate()
    if (pageDisposed.value) return
    objectUrl = URL.createObjectURL(result.blob)
    anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = result.filename.replace(/[^A-Za-z0-9._-]/g, '-') || 'launchlog-outreach.csv'
    document.body.appendChild(anchor)
    anchor.click()
    downloadSuccess.value = true
  }
  catch {
    if (!pageDisposed.value) downloadError.value = 'The browser did not complete the download. Review the current export audit before trying again.'
  }
  finally {
    anchor?.remove()
    if (objectUrl !== null) URL.revokeObjectURL(objectUrl)
  }
}

if (controller) void invoke(controller.load)

onMounted(mountPrivateHead)

watch(() => route.params.publicId, (next, previous) => {
  if (next !== previous) disposePageController()
})
onBeforeUnmount(() => {
  unmountPrivateHead()
  disposePageController()
})
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ pageAnnouncer }}</p>

    <a href="/admin/outreach" class="inline-flex items-center gap-2 rounded-md text-sm text-brand-muted outline-none transition hover:text-brand-fg focus-visible:ring-2 focus-visible:ring-brand-accent"><ArrowLeft class="size-4" /> Outreach workspace</a>

    <section v-if="invalidIdentifier" class="mt-8 rounded-xl border border-red-400/25 bg-red-400/10 p-6">
      <h1 class="text-xl font-semibold text-red-100">Candidate unavailable</h1>
      <p role="alert" class="mt-2 text-sm text-red-200">LaunchLog received an invalid candidate identifier. Return to the outreach list and choose a canonical record.</p>
    </section>

    <section v-else-if="!state || state.load === 'idle'" class="mt-8 rounded-xl border border-brand-border bg-white/[0.03] p-12 text-center">
      <AppSpinner label="Preparing candidate workspace" /><p class="mt-3 text-sm text-brand-muted">Preparing candidate workspace</p>
    </section>

    <section v-else-if="state.load === 'loading' && !candidate" class="mt-8 rounded-xl border border-brand-border bg-white/[0.03] p-12 text-center">
      <AppSpinner label="Loading outreach candidate" /><p class="mt-3 text-sm text-brand-muted">Loading outreach candidate</p>
    </section>

    <section v-else-if="state.load === 'load_error' && !candidate" class="mt-8 rounded-xl border border-red-400/25 bg-red-400/10 p-6">
      <p role="alert" class="text-sm text-red-200">{{ safeError(state.load_error) }}</p>
      <button type="button" class="mt-4 rounded-lg border border-red-300/30 px-4 py-2 text-sm font-medium text-red-100 outline-none hover:bg-red-300/10 focus-visible:ring-2 focus-visible:ring-red-300" @click="invoke(controller?.load)">Retry</button>
    </section>

    <template v-else-if="candidate && state">
      <header class="mt-6 flex flex-col gap-5 border-b border-brand-border pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div><p class="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-300">{{ candidate.campaign.name }} · {{ candidate.campaign.status }}</p><h1 class="mt-3 text-3xl font-semibold tracking-tight text-brand-fg sm:text-4xl">{{ candidate.prospect.product_name }}</h1><p class="mt-2 text-sm text-brand-muted">{{ candidate.prospect.company_name }} · Revision {{ candidate.revision }}</p></div>
        <div class="flex flex-wrap items-center gap-2"><span :data-status="candidate.effective_status" class="rounded-full border border-indigo-300/30 bg-indigo-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-100">{{ candidate.effective_status.replaceAll('_', ' ') }}</span><span class="rounded-full border border-white/10 px-3 py-1.5 text-xs text-brand-muted">Persisted {{ candidate.persisted_status.replaceAll('_', ' ') }}</span></div>
      </header>

      <div class="mt-5 space-y-3">
        <p v-if="pending" class="rounded-lg border border-indigo-300/20 bg-indigo-300/10 px-4 py-3 text-sm text-indigo-100">Working… Loaded candidate data remains visible.</p>
        <p v-if="state.refresh_required" class="rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">Refresh required before another revision-bound action.</p>
        <p v-if="state.prospect_edit === 'stale' || state.draft_edit === 'stale'" class="rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">This candidate changed. Reload and review the new revision.</p>
        <p v-if="safeError(state.action_error)" role="alert" class="rounded-lg border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">{{ safeError(state.action_error) }}</p>
        <p v-if="safeError(state.poll_error)" role="alert" class="rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{{ safeError(state.poll_error) }}</p>
      </div>

      <section v-if="generating" class="mt-6 rounded-xl border border-indigo-300/20 bg-indigo-300/10 p-5"><h2 class="font-semibold text-indigo-100">Preview generation in progress</h2><p class="mt-2 text-sm text-indigo-100/80">{{ state.poll_active ? 'Automatic checks are active' : state.poll_deadline_reached ? 'Automatic checks stopped after 10 minutes' : 'Waiting for the next controller update' }}.</p></section>

      <section v-if="state.discard_confirmation_required" class="mt-6 rounded-xl border border-amber-300/30 bg-amber-300/10 p-5"><h2 class="font-semibold text-amber-100">Discard all unsaved changes?</h2><p class="mt-2 text-sm text-amber-100/80">A fresh read replaces prospect, draft, and suppression edits.</p><div class="mt-4 flex gap-2"><button type="button" class="rounded-lg border border-white/15 px-4 py-2 text-sm text-brand-fg outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-brand-accent" @click="controller?.cancelDiscardRefresh()">Keep editing</button><button type="button" class="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 outline-none hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-amber-200" @click="discardAndRefresh">Discard and refresh</button></div></section>

      <div class="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <div class="space-y-6">
          <section class="rounded-2xl border border-brand-border bg-white/[0.03] p-5 sm:p-6">
            <div class="flex items-start justify-between gap-4"><div><p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">Prospect evidence</p><h2 class="mt-1 text-xl font-semibold text-brand-fg">Public record and contact</h2></div><button type="button" :disabled="pending" class="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-brand-muted outline-none hover:text-brand-fg focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-40" @click="invoke(controller?.refresh)"><RefreshCw class="size-4" />Refresh</button></div>
            <div class="mt-5 grid gap-4 sm:grid-cols-2">
              <div v-for="field in ([['company_name','Company name'],['product_name','Product name'],['founder_first_name','Founder first name'],['business_email','Business email'],['country_code','Country']] as const)" :key="field[0]"><label :for="field[0]" class="text-sm font-medium text-brand-fg">{{ field[1] }}</label><input :id="field[0]" :name="field[0]" :value="state.prospect_form[field[0]] ?? ''" :disabled="prospectInputLocked" :aria-invalid="firstError(field[0]) ? 'true' : 'false'" :aria-describedby="describeIds(field[0])" :class="inputClass" @input="setProspect(field[0], $event)"><p :id="`${field[0]}-description`" class="mt-1 text-xs text-brand-muted">Reviewed candidate evidence.</p><p :id="`${field[0]}-error`" :role="firstError(field[0]) ? 'alert' : undefined" class="min-h-5 text-xs text-red-300">{{ firstError(field[0]) }}</p></div>
              <div class="sm:col-span-2"><label for="product_url" class="text-sm font-medium text-brand-fg">Immutable product URL</label><input id="product_url" :value="candidate.prospect.product_url" readonly class="h-10 w-full rounded-lg border border-white/10 bg-white/[0.025] px-3 text-sm text-brand-muted outline-none"><p class="mt-1 text-xs text-brand-muted">Submitted product identity cannot be edited here.</p></div>
              <div class="sm:col-span-2"><label for="source_url" class="text-sm font-medium text-brand-fg">Public source URL</label><input id="source_url" name="source_url" :value="state.prospect_form.source_url" :disabled="prospectInputLocked" :aria-invalid="firstError('source_url') ? 'true' : 'false'" :aria-describedby="describeIds('source_url')" :class="inputClass" @input="setProspect('source_url', $event)"><p id="source_url-description" class="mt-1 text-xs text-brand-muted">Public evidence used during review.</p><p id="source_url-error" :role="firstError('source_url') ? 'alert' : undefined" class="min-h-5 text-xs text-red-300">{{ firstError('source_url') }}</p></div>
              <div class="sm:col-span-2"><label for="source_context" class="text-sm font-medium text-brand-fg">Public source context</label><textarea id="source_context" name="source_context" rows="3" :value="state.prospect_form.source_context" :disabled="prospectInputLocked" :aria-invalid="firstError('source_context') ? 'true' : 'false'" :aria-describedby="describeIds('source_context')" :class="[inputClass, 'h-auto py-3']" @input="setProspect('source_context', $event)"/><p id="source_context-description" class="mt-1 text-xs text-brand-muted">Why this source supports the record.</p><p id="source_context-error" :role="firstError('source_context') ? 'alert' : undefined" class="min-h-5 text-xs text-red-300">{{ firstError('source_context') }}</p></div>
              <div class="sm:col-span-2"><label for="notes" class="text-sm font-medium text-brand-fg">Notes</label><textarea id="notes" name="notes" rows="3" :value="state.prospect_form.notes ?? ''" :disabled="prospectInputLocked" :aria-invalid="firstError('notes') ? 'true' : 'false'" :aria-describedby="describeIds('notes')" :class="[inputClass, 'h-auto py-3']" @input="setProspect('notes', $event)"/><p id="notes-description" class="mt-1 text-xs text-brand-muted">Private reviewer context.</p><p id="notes-error" :role="firstError('notes') ? 'alert' : undefined" class="min-h-5 text-xs text-red-300">{{ firstError('notes') }}</p></div>
            </div>
            <div class="mt-4 flex flex-wrap items-center justify-between gap-3"><div class="flex gap-4 text-sm"><a v-if="evidenceUrl" :href="evidenceUrl" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-indigo-300 outline-none hover:text-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-300">View public evidence <ExternalLink class="size-3" /></a><a v-if="privatePlacementUrl" :href="privatePlacementUrl" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-indigo-300 outline-none hover:text-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-300">Open private placement <ExternalLink class="size-3" /></a></div><button type="button" :disabled="!canSaveProspect" class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white outline-none hover:bg-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-35" @click="invoke(controller?.saveProspect)">Save prospect</button></div>
          </section>

          <section class="rounded-2xl border border-brand-border bg-white/[0.03] p-5 sm:p-6">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">Plain-text draft</p><h2 class="mt-1 text-xl font-semibold text-brand-fg">Review copy</h2>
            <div class="mt-5 space-y-4"><div v-for="field in ([['subject_line','Subject line'],['opening_line','Opening line']] as const)" :key="field[0]"><label :for="field[0]" class="text-sm font-medium text-brand-fg">{{ field[1] }}</label><input :id="field[0]" :name="field[0]" :value="state.draft_form[field[0]]" :disabled="draftInputLocked" :aria-invalid="firstError(field[0]) ? 'true' : 'false'" :aria-describedby="describeIds(field[0])" :class="inputClass" @input="setDraft(field[0], $event)"><p :id="`${field[0]}-description`" class="mt-1 text-xs text-brand-muted">English plain-text candidate copy.</p><p :id="`${field[0]}-error`" :role="firstError(field[0]) ? 'alert' : undefined" class="min-h-5 text-xs text-red-300">{{ firstError(field[0]) }}</p></div><div><label for="email_body" class="text-sm font-medium text-brand-fg">Body</label><textarea id="email_body" name="email_body" rows="8" :value="state.draft_form.email_body" :disabled="draftInputLocked" :aria-invalid="firstError('email_body') ? 'true' : 'false'" :aria-describedby="describeIds('email_body')" :class="[inputClass, 'h-auto py-3 font-mono leading-6']" @input="setDraft('email_body', $event)"/><p id="email_body-description" class="mt-1 text-xs text-brand-muted">The exact plain-text CSV draft.</p><p id="email_body-error" :role="firstError('email_body') ? 'alert' : undefined" class="min-h-5 text-xs text-red-300">{{ firstError('email_body') }}</p></div></div>
            <div class="mt-4 flex justify-end"><button type="button" :disabled="!canSaveDraft" class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white outline-none hover:bg-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-35" @click="invoke(controller?.saveDraft)">Save draft</button></div>
          </section>

          <fieldset class="rounded-2xl border border-brand-border bg-white/[0.03] p-5 sm:p-6">
            <legend class="px-2 text-sm font-semibold text-brand-fg">Approval confirmations</legend><p id="confirm_english_plain_text-description" class="text-sm leading-6 text-brand-muted">Approval requires clean prospect and draft sections at the current revision.</p><p id="confirm_public_source-description" class="sr-only">Confirm the source was reviewed at this revision.</p>
            <label class="mt-4 flex cursor-pointer items-start gap-3 rounded-lg outline-none focus-within:ring-2 focus-within:ring-indigo-300">
              <input name="confirm_english_plain_text" type="checkbox" :checked="state.approval_english_plain_text" :disabled="revisionLocked" aria-describedby="confirm_english_plain_text-description" class="peer sr-only" @change="invokeSetter(() => controller?.setApprovalEnglishPlainText(($event.target as HTMLInputElement).checked))">
              <span aria-hidden="true" class="relative mt-0.5 size-5 shrink-0 rounded-md border border-white/25 bg-black/40 transition after:absolute after:left-[6px] after:top-[2px] after:h-3 after:w-1.5 after:rotate-45 after:border-b-2 after:border-r-2 after:border-white after:opacity-0 peer-checked:border-indigo-300 peer-checked:bg-indigo-500 peer-checked:after:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#0a0e1a] peer-disabled:opacity-35" />
              <span>I reviewed the English plain-text copy</span>
            </label>
            <label class="mt-3 flex cursor-pointer items-start gap-3 rounded-lg outline-none focus-within:ring-2 focus-within:ring-indigo-300">
              <input name="confirm_public_source" type="checkbox" :checked="state.approval_public_source" :disabled="revisionLocked" aria-describedby="confirm_public_source-description" class="peer sr-only" @change="invokeSetter(() => controller?.setApprovalPublicSource(($event.target as HTMLInputElement).checked))">
              <span aria-hidden="true" class="relative mt-0.5 size-5 shrink-0 rounded-md border border-white/25 bg-black/40 transition after:absolute after:left-[6px] after:top-[2px] after:h-3 after:w-1.5 after:rotate-45 after:border-b-2 after:border-r-2 after:border-white after:opacity-0 peer-checked:border-indigo-300 peer-checked:bg-indigo-500 peer-checked:after:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#0a0e1a] peer-disabled:opacity-35" />
              <span>I reviewed the public source evidence</span>
            </label>
            <p v-if="state.view.blockers.approve.includes('draft_not_clean')" class="mt-4 text-sm text-amber-200">Save the draft before approval.</p><p v-if="state.view.blockers.approve.includes('ttl_under_24h')" class="mt-4 text-sm text-amber-200">Less than 24 hours remain; renew before approval.</p>
            <button type="button" :disabled="!canApprove" class="mt-5 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 outline-none hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-35" @click="invoke(controller?.approve)">Approve</button>
          </fieldset>
        </div>

        <aside class="space-y-6">
          <section class="rounded-2xl border border-brand-border bg-white/[0.03] p-5"><IntakePlacementPreview :preview="placement" tier="featured" :title="placementTitle" :tagline="placementTagline" :generating="generating" :context-screenshots="candidate.preview !== null" /></section>

          <section class="rounded-2xl border border-brand-border bg-white/[0.03] p-5"><p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">Preview timing</p><p class="mt-3 text-sm text-brand-fg">Expires {{ state.view.timing.expires_at ?? 'not available' }}</p><p class="mt-2 text-sm text-brand-muted">Remaining at last refresh: {{ state.view.timing.remaining_ms === null ? 'unknown' : `${Math.max(0, Math.ceil(state.view.timing.remaining_ms / 3600000))} hours` }}</p><div class="mt-4 grid grid-cols-2 gap-2"><button type="button" :disabled="!canRecapture" class="rounded-lg border border-white/15 px-3 py-2 text-sm text-brand-fg outline-none hover:border-indigo-300/50 focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-35" @click="invoke(controller?.recapture)">Recapture preview</button><button type="button" :disabled="!canRenew" class="rounded-lg border border-white/15 px-3 py-2 text-sm text-brand-fg outline-none hover:border-indigo-300/50 focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-35" @click="invoke(controller?.renew)">Renew preview</button></div></section>

          <section v-if="candidate.campaign.status === 'draft'" class="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-5">
            <h2 class="font-semibold text-amber-100">Enable CSV export in LaunchLog</h2>
            <p class="mt-2 text-sm text-amber-100/80">This changes LaunchLog CSV eligibility only.</p>
            <button v-if="!activationOpen" type="button" :disabled="activationLocked" class="mt-4 rounded-lg border border-amber-200/30 px-4 py-2 text-sm text-amber-50 outline-none hover:bg-amber-200/10 focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-35" @click="activationOpen = true">Enable CSV export in LaunchLog</button>
            <template v-else>
              <label class="mt-4 flex cursor-pointer items-start gap-3 rounded-lg text-sm text-amber-50 outline-none focus-within:ring-2 focus-within:ring-amber-200">
                <input name="confirm_campaign_activation" type="checkbox" :checked="state.campaign_activation_confirmed" :disabled="activationLocked" class="peer sr-only" @change="invokeSetter(() => controller?.setCampaignActivationConfirmed(($event.target as HTMLInputElement).checked))">
                <span aria-hidden="true" class="relative mt-0.5 size-5 shrink-0 rounded-md border border-amber-200/40 bg-black/35 transition after:absolute after:left-[6px] after:top-[2px] after:h-3 after:w-1.5 after:rotate-45 after:border-b-2 after:border-r-2 after:border-slate-950 after:opacity-0 peer-checked:border-amber-300 peer-checked:bg-amber-300 peer-checked:after:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-200 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#2a2415] peer-disabled:opacity-35" />
                <span>I confirm this enables internal CSV eligibility only</span>
              </label>
              <button type="button" :disabled="activationLocked || !state.campaign_activation_confirmed" class="mt-4 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 outline-none hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-35" @click="invoke(controller?.activateCampaign)">Confirm CSV eligibility</button>
            </template>
          </section>
          <p v-if="candidate.campaign.status === 'archived'" class="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-brand-muted">Archived campaigns are terminal. Suppression remains available.</p>

          <section class="rounded-2xl border border-brand-border bg-white/[0.03] p-5">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">Durable audit</p>
            <dl class="mt-4 space-y-3 text-sm">
              <div>
                <dt class="text-brand-muted">Approval</dt>
                <dd class="mt-1 text-brand-fg">{{ candidate.audit.approved_at ? `Approved ${candidate.audit.approved_at}` : 'Not approved' }}<span v-if="candidate.audit.approved_by"> · {{ candidate.audit.approved_by.name ?? candidate.audit.approved_by.email ?? 'Admin reviewer' }}</span></dd>
              </div>
              <div>
                <dt class="text-brand-muted">CSV history</dt>
                <dd class="mt-1 text-brand-fg">{{ exportCount ? `Exported ${exportCount} times` : 'No CSV exports' }}<template v-if="candidate.audit.exported_at"> · {{ candidate.audit.exported_at }}</template><span v-if="candidate.audit.exported_by"> · {{ candidate.audit.exported_by.name ?? candidate.audit.exported_by.email ?? 'Admin reviewer' }}</span></dd>
              </div>
            </dl>
            <p v-if="exportCount > 0" class="mt-4 text-sm text-amber-200">Every further export requires confirmation.</p>
            <label v-if="exportCount > 0" class="mt-3 flex cursor-pointer items-start gap-3 rounded-lg text-sm text-brand-fg outline-none focus-within:ring-2 focus-within:ring-amber-200">
              <input name="confirm_reexport" type="checkbox" :checked="state.reexport_confirmed" :disabled="revisionLocked" class="peer sr-only" @change="invokeSetter(() => controller?.setReexportConfirmed(($event.target as HTMLInputElement).checked))">
              <span aria-hidden="true" class="relative mt-0.5 size-5 shrink-0 rounded-md border border-amber-200/40 bg-black/35 transition after:absolute after:left-[6px] after:top-[2px] after:h-3 after:w-1.5 after:rotate-45 after:border-b-2 after:border-r-2 after:border-slate-950 after:opacity-0 peer-checked:border-amber-300 peer-checked:bg-amber-300 peer-checked:after:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-200 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#0a0e1a] peer-disabled:opacity-35" />
              <span>I reviewed the audit and confirm this re-export</span>
            </label>
            <p v-if="downloadError" role="alert" class="mt-3 text-sm text-red-200">{{ downloadError }}</p>
            <p v-if="downloadSuccess" class="mt-3 text-sm text-emerald-200">Download completed.</p>
            <button type="button" :disabled="!canExport" class="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 outline-none hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-35" @click="downloadCsv"><Download class="size-4" />Download CSV</button>
          </section>

          <section class="rounded-2xl border border-red-400/25 bg-red-400/[0.07] p-5">
            <div class="flex gap-3"><ShieldAlert class="mt-0.5 size-5 shrink-0 text-red-300"/><div><h2 class="font-semibold text-red-100">Permanent suppression</h2><p class="mt-1 text-sm leading-6 text-red-100/75">Irreversible in MVP. Choose only a candidate-derived target and confirm against revision {{ candidate.revision }}.</p></div></div>
            <fieldset class="mt-5">
              <legend class="text-sm font-medium text-red-100">Suppression target</legend>
              <div class="mt-3 space-y-2">
                <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-red-300/15 p-3 text-sm text-red-50 transition hover:border-red-300/30 focus-within:ring-2 focus-within:ring-red-300">
                  <input name="suppression_target" type="radio" value="email" :checked="state.suppression_draft.target === 'email'" :disabled="suppressionDraftLocked" class="peer sr-only" @change="invokeSetter(() => controller?.setSuppressionTarget('email'))">
                  <span aria-hidden="true" class="relative mt-0.5 size-5 shrink-0 rounded-full border border-red-200/35 bg-black/40 transition after:absolute after:inset-1 after:scale-0 after:rounded-full after:bg-white after:transition-transform peer-checked:border-red-300 peer-checked:bg-red-500 peer-checked:after:scale-100 peer-focus-visible:ring-2 peer-focus-visible:ring-red-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#211017] peer-disabled:opacity-35" />
                  <span>Email · {{ candidate.prospect.business_email }}</span>
                </label>
                <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-red-300/15 p-3 text-sm text-red-50 transition hover:border-red-300/30 focus-within:ring-2 focus-within:ring-red-300">
                  <input name="suppression_target" type="radio" value="product_domain" :checked="state.suppression_draft.target === 'product_domain'" :disabled="suppressionDraftLocked" class="peer sr-only" @change="invokeSetter(() => controller?.setSuppressionTarget('product_domain'))">
                  <span aria-hidden="true" class="relative mt-0.5 size-5 shrink-0 rounded-full border border-red-200/35 bg-black/40 transition after:absolute after:inset-1 after:scale-0 after:rounded-full after:bg-white after:transition-transform peer-checked:border-red-300 peer-checked:bg-red-500 peer-checked:after:scale-100 peer-focus-visible:ring-2 peer-focus-visible:ring-red-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#211017] peer-disabled:opacity-35" />
                  <span>Product domain · {{ candidate.prospect.normalized_domain }}</span>
                </label>
                <label v-if="effectiveDomainAvailable" class="flex cursor-pointer items-start gap-3 rounded-lg border border-red-300/15 p-3 text-sm text-red-50 transition hover:border-red-300/30 focus-within:ring-2 focus-within:ring-red-300">
                  <input name="suppression_target" type="radio" value="effective_domain" :checked="state.suppression_draft.target === 'effective_domain'" :disabled="suppressionDraftLocked" class="peer sr-only" @change="invokeSetter(() => controller?.setSuppressionTarget('effective_domain'))">
                  <span aria-hidden="true" class="relative mt-0.5 size-5 shrink-0 rounded-full border border-red-200/35 bg-black/40 transition after:absolute after:inset-1 after:scale-0 after:rounded-full after:bg-white after:transition-transform peer-checked:border-red-300 peer-checked:bg-red-500 peer-checked:after:scale-100 peer-focus-visible:ring-2 peer-focus-visible:ring-red-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#211017] peer-disabled:opacity-35" />
                  <span>Effective domain · {{ candidate.preview?.normalized_domain }}</span>
                </label>
              </div>
            </fieldset>
            <div class="mt-4">
              <label for="suppression_reason" class="text-sm font-medium text-red-100">Reason</label>
              <textarea id="suppression_reason" name="suppression_reason" rows="3" :value="state.suppression_draft.reason" :disabled="suppressionDraftLocked" :aria-invalid="suppressionReasonError ? 'true' : 'false'" aria-describedby="suppression-reason-description suppression-reason-error" class="mt-1 h-auto w-full rounded-lg border border-red-300/20 bg-black/25 px-3 py-3 text-sm text-red-50 outline-none focus-visible:border-red-300 focus-visible:ring-2 focus-visible:ring-red-300/30 disabled:cursor-not-allowed disabled:opacity-35 aria-[invalid=true]:border-red-400" @input="invokeSetter(() => controller?.setSuppressionReason(($event.target as HTMLTextAreaElement).value))"/>
              <p id="suppression-reason-description" class="mt-1 min-h-5 text-xs leading-5 text-red-100/65">Record the reviewed public request or operator rationale.</p>
              <p id="suppression-reason-error" :role="suppressionReasonError ? 'alert' : 'status'" class="min-h-5 text-xs leading-5 text-red-300">{{ suppressionReasonError }}</p>
            </div>
            <fieldset class="mt-4">
              <legend class="text-sm font-medium text-red-100">Suppression source</legend>
              <div class="mt-2 flex flex-wrap gap-3">
                <label class="flex cursor-pointer items-center gap-3 rounded-lg border border-red-300/15 px-3 py-2 text-sm text-red-50 focus-within:ring-2 focus-within:ring-red-300">
                  <input name="suppression_source" type="radio" value="manual" :checked="state.suppression_draft.source === 'manual'" :disabled="suppressionDraftLocked" class="peer sr-only" @change="invokeSetter(() => controller?.setSuppressionSource('manual' as OutreachSuppressionSource))">
                  <span aria-hidden="true" class="relative size-5 shrink-0 rounded-full border border-red-200/35 bg-black/40 transition after:absolute after:inset-1 after:scale-0 after:rounded-full after:bg-white after:transition-transform peer-checked:border-red-300 peer-checked:bg-red-500 peer-checked:after:scale-100 peer-focus-visible:ring-2 peer-focus-visible:ring-red-300 peer-disabled:opacity-35" />
                  <span>Manual review</span>
                </label>
                <label class="flex cursor-pointer items-center gap-3 rounded-lg border border-red-300/15 px-3 py-2 text-sm text-red-50 focus-within:ring-2 focus-within:ring-red-300">
                  <input name="suppression_source" type="radio" value="opt_out" :checked="state.suppression_draft.source === 'opt_out'" :disabled="suppressionDraftLocked" class="peer sr-only" @change="invokeSetter(() => controller?.setSuppressionSource('opt_out' as OutreachSuppressionSource))">
                  <span aria-hidden="true" class="relative size-5 shrink-0 rounded-full border border-red-200/35 bg-black/40 transition after:absolute after:inset-1 after:scale-0 after:rounded-full after:bg-white after:transition-transform peer-checked:border-red-300 peer-checked:bg-red-500 peer-checked:after:scale-100 peer-focus-visible:ring-2 peer-focus-visible:ring-red-300 peer-disabled:opacity-35" />
                  <span>Public opt-out</span>
                </label>
              </div>
            </fieldset>
            <label class="mt-4 flex cursor-pointer items-start gap-3 rounded-lg text-sm text-red-50 outline-none focus-within:ring-2 focus-within:ring-red-300">
              <input name="suppression_confirm" type="checkbox" :checked="state.suppression_draft.confirmed" :disabled="suppressionConfirmationLocked" class="peer sr-only" @change="invokeSetter(() => controller?.setSuppressionConfirmed(($event.target as HTMLInputElement).checked))">
              <span aria-hidden="true" class="relative mt-0.5 size-5 shrink-0 rounded-md border border-red-200/35 bg-black/40 transition after:absolute after:left-[6px] after:top-[2px] after:h-3 after:w-1.5 after:rotate-45 after:border-b-2 after:border-r-2 after:border-white after:opacity-0 peer-checked:border-red-300 peer-checked:bg-red-500 peer-checked:after:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-red-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#211017] peer-disabled:cursor-not-allowed peer-disabled:opacity-35" />
              <span>I reviewed this target and confirm permanent suppression at the current revision</span>
            </label>
            <button type="button" :disabled="!canSuppress" class="mt-5 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white outline-none hover:bg-red-400 focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-35" @click="invoke(controller?.suppress)">Suppress permanently</button>
            <div v-if="candidate.suppressions.length" class="mt-5 border-t border-red-300/15 pt-4"><h3 class="text-sm font-medium text-red-100">Suppression history</h3><ul class="mt-2 space-y-2 text-xs text-red-100/70"><li v-for="item in candidate.suppressions" :key="`${item.kind}-${item.normalized_value}`">Suppressed {{ item.normalized_value }} · {{ item.reason }} · {{ item.created_by?.name ?? 'Admin reviewer' }}</li></ul></div>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>
