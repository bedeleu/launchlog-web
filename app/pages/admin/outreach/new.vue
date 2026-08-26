<script setup lang="ts">
import { ArrowLeft, Archive, CircleDot, Plus } from '@lucide/vue'
import type { OutreachCampaign, OutreachCandidateDetail, OutreachApiError } from '~/composables/useAdminOutreach'
import type { OutreachCandidateCreateInput } from '~/utils/outreach-form-schema'

definePageMeta({ middleware: 'admin' })
const privatePageTitle = 'New outreach candidate · LaunchLog'
const privateHeadMarker = 'outreach-new'
if (import.meta.server) {
  useHead({
    title: privatePageTitle,
    meta: [{ name: 'robots', content: 'noindex, nofollow', 'data-launchlog-private-head': privateHeadMarker }],
  })
}

const client = useAdminOutreach()
const campaigns = ref<OutreachCampaign[]>([])
const loadState = ref<'loading' | 'ready' | 'error'>('loading')
const selectedCampaign = ref('')
const submitting = ref(false)
const backendErrors = ref<Record<string, string[]>>({})
const actionError = ref<string | null>(null)
const committedId = ref<string | null>(null)
const committedNotice = ref<string | null>(null)
const refreshRequired = ref(false)
const mounted = ref(true)
let loadAbort: AbortController | null = null
let submitAbort: AbortController | null = null
let previousDocumentTitle = ''
let privateRobotsMeta: HTMLMetaElement | null = null

const usableCampaigns = computed(() => campaigns.value.filter(item => item.status !== 'archived'))
const announcer = computed(() => {
  if (loadState.value === 'loading') return 'Loading outreach campaigns'
  if (loadState.value === 'error') return 'Campaigns could not be loaded'
  if (submitting.value) return 'Creating candidate'
  if (committedId.value) return 'Candidate saved; creation locked'
  return `${usableCampaigns.value.length} campaigns available`
})

function safeError(error: unknown): string {
  const kind = (error as OutreachApiError | undefined)?.kind
  if (kind === 'network') return 'Could not reach LaunchLog. Check the connection and retry.'
  if (kind === 'conflict' || kind === 'stale_revision') return 'This request conflicts with the current candidate state. Review the latest data before trying again.'
  if (kind === 'validation') return 'Check the highlighted fields.'
  return 'LaunchLog could not complete this request. Try again after reviewing the current state.'
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

async function loadCampaigns(): Promise<void> {
  loadAbort?.abort()
  const request = new AbortController()
  loadAbort = request
  loadState.value = 'loading'
  actionError.value = null
  try {
    const result = await client.listCampaigns({ signal: request.signal })
    if (!mounted.value || request.signal.aborted || loadAbort !== request) return
    campaigns.value = result
    if (!usableCampaigns.value.some(item => item.key === selectedCampaign.value)) {
      selectedCampaign.value = usableCampaigns.value[0]?.key ?? ''
    }
    loadState.value = 'ready'
  }
  catch (error) {
    if (!mounted.value || request.signal.aborted || loadAbort !== request) return
    loadState.value = 'error'
    actionError.value = safeError(error)
  }
}

function isDetail(value: unknown): value is OutreachCandidateDetail {
  return typeof value === 'object' && value !== null && 'campaign' in value && 'prospect' in value && 'public_id' in value
}

function lockCommittedCandidate(publicId: string): void {
  committedId.value = publicId
  committedNotice.value = 'The candidate was saved. Open the saved candidate to continue; this create cannot be replayed.'
}

async function navigateToCommittedCandidate(publicId: string): Promise<void> {
  lockCommittedCandidate(publicId)
  try {
    await navigateTo(`/admin/outreach/${publicId}`)
  }
  catch {
    // The Resource is already committed; keep the locked recovery surface in place.
  }
}

async function createCandidate(payload: OutreachCandidateCreateInput): Promise<void> {
  if (submitting.value || refreshRequired.value || committedId.value !== null) return
  submitAbort?.abort()
  const request = new AbortController()
  submitAbort = request
  submitting.value = true
  backendErrors.value = {}
  actionError.value = null
  committedNotice.value = null
  try {
    const result = await client.createCandidate(payload, { signal: request.signal })
    if (!mounted.value || request.signal.aborted || submitAbort !== request) return
    if (isDetail(result)) {
      await navigateToCommittedCandidate(result.public_id)
      return
    }

    let publicId: string
    try {
      publicId = validateCommittedRecovery(result)
    }
    catch {
      refreshRequired.value = true
      actionError.value = 'LaunchLog could not verify the saved candidate response. Refresh required before any further action.'
      return
    }

    lockCommittedCandidate(publicId)
    try {
      await client.getCandidate(publicId)
      if (mounted.value && !request.signal.aborted && submitAbort === request) {
        await navigateToCommittedCandidate(publicId)
      }
    }
    catch {
      if (mounted.value && !request.signal.aborted && submitAbort === request) {
        refreshRequired.value = true
        committedNotice.value = 'The candidate was saved, but LaunchLog could not reload it. Open the saved candidate when the connection is available.'
      }
    }
  }
  catch (error) {
    if (!mounted.value || request.signal.aborted || submitAbort !== request) return
    const outreachError = error as OutreachApiError
    backendErrors.value = outreachError.fieldErrors ?? {}
    actionError.value = safeError(error)
  }
  finally {
    if (mounted.value && submitAbort === request) submitting.value = false
  }
}

onMounted(() => {
  mountPrivateHead()
  void loadCampaigns()
})
onBeforeUnmount(() => {
  unmountPrivateHead()
  mounted.value = false
  loadAbort?.abort()
  submitAbort?.abort()
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ announcer }}</p>

    <NuxtLink to="/admin/outreach" class="inline-flex items-center gap-2 rounded-md text-sm text-brand-muted outline-none transition hover:text-brand-fg focus-visible:ring-2 focus-visible:ring-brand-accent">
      <ArrowLeft class="size-4" /> Outreach workspace
    </NuxtLink>
    <div class="mt-6 border-b border-brand-border pb-7">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-300">Private operations</p>
      <h1 class="mt-3 text-3xl font-semibold tracking-tight text-brand-fg sm:text-4xl">New outreach candidate</h1>
      <p class="mt-3 max-w-2xl text-sm leading-6 text-brand-muted">Prepare one reviewed prospect and its managed placement. The final operational artifact is a LaunchLog CSV download.</p>
    </div>

    <section v-if="loadState === 'loading'" class="mt-8 rounded-xl border border-brand-border bg-white/[0.03] p-10 text-center">
      <AppSpinner label="Loading outreach campaigns" />
      <p class="mt-3 text-sm text-brand-muted">Loading outreach campaigns</p>
    </section>

    <section v-else-if="loadState === 'error'" class="mt-8 rounded-xl border border-red-400/25 bg-red-400/10 p-5">
      <p role="alert" class="text-sm text-red-200">{{ actionError }}</p>
      <button type="button" class="mt-4 rounded-lg border border-red-300/30 px-4 py-2 text-sm font-medium text-red-100 outline-none hover:bg-red-300/10 focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-50" @click="loadCampaigns">Retry</button>
    </section>

    <template v-else>
      <section v-if="usableCampaigns.length === 0" class="mt-8 rounded-xl border border-amber-300/25 bg-amber-300/10 p-6">
        <p class="text-sm text-amber-100">Create a non-archived campaign first from the outreach workspace.</p>
        <NuxtLink to="/admin/outreach" class="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-200/30 px-4 py-2 text-sm font-medium text-amber-50 outline-none hover:bg-amber-200/10 focus-visible:ring-2 focus-visible:ring-amber-200">
          <Plus class="size-4" /> Open campaign controls
        </NuxtLink>
      </section>

      <template v-else>
        <fieldset class="mt-8">
          <legend class="text-sm font-semibold text-brand-fg">Choose one LaunchLog campaign</legend>
          <div class="mt-3 grid gap-3 md:grid-cols-2">
            <label
              v-for="campaign in campaigns"
              :key="campaign.key"
              class="relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 outline-none transition focus-within:ring-2 focus-within:ring-brand-accent"
              :class="campaign.status === 'archived' ? 'cursor-not-allowed border-white/5 bg-white/[0.02] opacity-55' : selectedCampaign === campaign.key ? 'border-indigo-400/60 bg-indigo-400/10' : 'border-white/10 bg-white/[0.035] hover:border-white/20'"
            >
              <input v-model="selectedCampaign" type="radio" name="campaign_key" :value="campaign.key" :disabled="campaign.status === 'archived' || submitting || refreshRequired || committedId !== null" class="peer sr-only">
              <span aria-hidden="true" class="relative mt-0.5 size-5 shrink-0 rounded-full border border-white/25 bg-black/40 shadow-inner shadow-black/30 transition after:absolute after:inset-1 after:scale-0 after:rounded-full after:bg-white after:transition-transform peer-checked:border-indigo-300 peer-checked:bg-indigo-500 peer-checked:after:scale-100 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#0a0e1a] peer-disabled:opacity-35" />
              <span class="min-w-0">
                <span class="flex items-center gap-2 font-medium text-brand-fg">
                  <Archive v-if="campaign.status === 'archived'" class="size-4 text-brand-muted" />
                  <CircleDot v-else class="size-4 text-indigo-300" />
                  {{ campaign.name }}
                </span>
                <span class="mt-1 block text-xs uppercase tracking-[0.16em] text-brand-muted">{{ campaign.status }} · {{ campaign.sender_identity_label }}</span>
              </span>
            </label>
          </div>
        </fieldset>

        <section class="mt-8 rounded-2xl border border-brand-border bg-white/[0.03] p-5 sm:p-7">
          <p v-if="actionError" role="alert" class="mb-5 rounded-lg border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">{{ actionError }}</p>
          <p v-if="committedNotice" role="status" class="mb-5 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{{ committedNotice }}</p>
          <p v-if="refreshRequired" class="mb-5 rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">Refresh required. This committed create must not be replayed.</p>
          <NuxtLink v-if="committedId" :to="`/admin/outreach/${committedId}`" class="mb-5 inline-flex rounded-md text-sm font-medium text-indigo-300 outline-none hover:text-indigo-200 focus-visible:ring-2 focus-visible:ring-brand-accent">Open saved candidate</NuxtLink>
          <AdminOutreachCandidateForm
            v-if="!refreshRequired && committedId === null"
            :campaign-key="selectedCampaign"
            :submitting="submitting"
            :backend-errors="backendErrors"
            @submit="createCandidate"
          />
        </section>
      </template>
    </template>
  </div>
</template>
