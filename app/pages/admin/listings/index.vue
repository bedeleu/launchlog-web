<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { Check, FileDiff, ShieldCheck } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { AdminListing, AdminListingFilters, AdminListingPaginationMeta, FounderScreenshotStatus, ListingStatus } from '~/composables/useAdminListings'
import type { AiEnrichmentBatch, AiEnrichmentField, AiEnrichmentPayload, AiEnrichmentProposal } from '~/composables/useAiEnrichment'
import { aiFieldDisplayValue, aiFieldLinks } from '~/utils/ai-enrichment-review'
import { toErrorLike } from '~/utils/error-like'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Admin · Listings', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const { list, publish, unpublish, reject, runFounderScreenshots, founderScreenshotStatus } = useAdminListings()
const { createBatch, getBatch, applyBatch } = useAiEnrichment()
const route = useRoute()
const router = useRouter()

const queryValue = (value: unknown): string => typeof value === 'string' ? value.trim() : ''
const queryPage = Number.parseInt(queryValue(route.query.page), 10)
const filters = reactive<AdminListingFilters>({
  status: queryValue(route.query.status),
  tier: queryValue(route.query.tier),
  source: queryValue(route.query.source),
  q: queryValue(route.query.q),
})
const listings = ref<AdminListing[]>([])
const pagination = ref<AdminListingPaginationMeta | null>(null)
const page = ref(Number.isFinite(queryPage) && queryPage > 0 ? queryPage : 1)
const loading = ref(false)
const error = ref<string | null>(null)
const actionBusy = reactive<Record<string, 'publish' | 'unpublish' | 'reject' | undefined>>({})
const actionErrors = reactive<Record<string, string | undefined>>({})
const screenshotStatus = ref<FounderScreenshotStatus | null>(null)
const screenshotBusy = ref(false)
const screenshotMessage = ref<string | null>(null)
const aiBatch = ref<AiEnrichmentBatch | null>(null)
const aiBatchBusy = ref(false)
const aiBatchError = ref<string | null>(null)
const aiBatchLimit = ref(25)
const selectedProposalIds = ref<string[]>([])
const selectedBatchFields = ref<AiEnrichmentField[]>([])
const batchConfirmationOpen = ref(false)
const batchFieldLabels: Record<AiEnrichmentField, string> = {
  name: 'Name',
  tagline: 'Tagline',
  description: 'Description',
  category: 'Category',
  logo_url: 'Logo',
  social_links: 'Social links',
}
let loadRequestId = 0

const selectableProposals = computed(() => aiBatch.value?.proposals?.filter(proposal => proposal.status === 'pending') ?? [])
const selectedProposals = computed(() => selectableProposals.value.filter(proposal => selectedProposalIds.value.includes(proposal.id)))
const categorySelectionBlocked = computed(() => selectedBatchFields.value.includes('category')
  && selectedProposals.value.some(proposal => proposal.category.requires_approval))
const canApplyBatch = computed(() => aiBatch.value?.status === 'ready'
  && selectedProposalIds.value.length > 0
  && selectedBatchFields.value.length > 0
  && !categorySelectionBlocked.value
  && !aiBatchBusy.value)
const proposalPayload = (proposal: AiEnrichmentProposal, side: 'current' | 'proposed'): AiEnrichmentPayload => proposal[side]

const { pause: stopBatchPolling, resume: startBatchPolling } = useIntervalFn(async () => {
  if (!aiBatch.value || !['queued', 'running'].includes(aiBatch.value.status)) {
    stopBatchPolling()
    return
  }
  try {
    aiBatch.value = await getBatch(aiBatch.value.id)
    if (aiBatch.value.status === 'ready') {
      stopBatchPolling()
    }
  }
  catch (e: unknown) {
    aiBatchError.value = errorMessage(e, 'The dry run status could not be refreshed.')
    stopBatchPolling()
  }
}, 2500, { immediate: false })

const statusClass: Record<ListingStatus, string> = {
  published: 'border-brand-accent/40 bg-brand-accent/10 text-brand-accent',
  pending_review: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  rejected: 'border-red-500/40 bg-red-500/10 text-red-400',
  draft: 'border-brand-border bg-white/[0.04] text-brand-muted',
  archived: 'border-brand-border bg-white/[0.04] text-brand-muted',
  spam: 'border-red-500/40 bg-red-500/10 text-red-400',
}

function errorMessage(e: unknown, fallback: string): string {
  const err = toErrorLike(e)
  return err.data?.message ?? err.data?.error ?? err.message ?? fallback
}

async function syncQuery() {
  const query: Record<string, string> = {}
  if (filters.status) query.status = filters.status
  if (filters.tier) query.tier = filters.tier
  if (filters.source) query.source = filters.source
  if (filters.q) query.q = filters.q
  if (page.value > 1) query.page = String(page.value)
  await router.replace({ query })
}

async function load(targetPage = 1) {
  const requestId = ++loadRequestId
  loading.value = true
  error.value = null
  try {
    const response = await list({ ...filters, page: targetPage })
    if (requestId !== loadRequestId) return

    if (response.data.length === 0 && targetPage > response.meta.last_page) {
      await load(Math.max(1, response.meta.last_page))
      return
    }

    listings.value = response.data
    pagination.value = response.meta
    page.value = response.meta.current_page
    await syncQuery()
  }
  catch (e: unknown) {
    if (requestId !== loadRequestId) return
    error.value = errorMessage(e, 'Failed to load listings')
  }
  finally {
    if (requestId === loadRequestId) loading.value = false
  }
}

async function act(l: AdminListing, verb: 'publish' | 'unpublish' | 'reject') {
  actionBusy[l.id] = verb
  actionErrors[l.id] = undefined
  const fn = verb === 'publish' ? publish : verb === 'unpublish' ? unpublish : reject
  try {
    const updated = await fn(l.id)
    if (filters.status && updated.status !== filters.status) {
      await load(page.value)
    }
    else {
      const index = listings.value.findIndex(listing => listing.id === updated.id)
      if (index !== -1) listings.value[index] = updated
    }
  }
  catch (e: unknown) {
    actionErrors[l.id] = errorMessage(e, `Failed to ${verb} listing`)
  }
  finally {
    actionBusy[l.id] = undefined
  }
}

async function refreshScreenshotStatus() {
  screenshotStatus.value = await founderScreenshotStatus()
}

async function startScreenshotBatch(dryRun = false) {
  screenshotBusy.value = true
  screenshotMessage.value = null
  error.value = null
  try {
    const run = await runFounderScreenshots(50, dryRun)
    screenshotMessage.value = `${dryRun ? 'Dry run' : 'Batch'} started in Railway (PID ${run.pid}).`
    await refreshScreenshotStatus()
  }
  catch (e: unknown) {
    const err = toErrorLike(e)
    error.value = err.data?.message ?? err.data?.error ?? err.message ?? 'Failed to start screenshot batch'
  }
  finally {
    screenshotBusy.value = false
  }
}

async function startAiDryRun() {
  if (aiBatchBusy.value) return
  aiBatchBusy.value = true
  aiBatchError.value = null
  batchConfirmationOpen.value = false
  selectedProposalIds.value = []
  selectedBatchFields.value = []
  try {
    aiBatch.value = await createBatch({
      limit: Math.min(Math.max(aiBatchLimit.value, 1), 100),
      filters: {
        status: filters.status || undefined,
        tier: filters.tier || undefined,
        source: ['customer', 'admin', 'founding'].includes(filters.source || '') ? filters.source : undefined,
      },
    })
    selectedProposalIds.value = []
    if (['queued', 'running'].includes(aiBatch.value.status)) startBatchPolling()
    else aiBatch.value = await getBatch(aiBatch.value.id)
  }
  catch (e: unknown) {
    aiBatchError.value = errorMessage(e, 'The AI dry run could not be created.')
  }
  finally {
    aiBatchBusy.value = false
  }
}

function toggleProposal(id: string) {
  selectedProposalIds.value = selectedProposalIds.value.includes(id)
    ? selectedProposalIds.value.filter(proposalId => proposalId !== id)
    : [...selectedProposalIds.value, id]
  batchConfirmationOpen.value = false
}

function toggleBatchField(field: AiEnrichmentField) {
  selectedBatchFields.value = selectedBatchFields.value.includes(field)
    ? selectedBatchFields.value.filter(item => item !== field)
    : [...selectedBatchFields.value, field]
  batchConfirmationOpen.value = false
}

async function applySelectedBatch() {
  if (!aiBatch.value || !canApplyBatch.value || !batchConfirmationOpen.value) {
    batchConfirmationOpen.value = true
    return
  }
  aiBatchBusy.value = true
  aiBatchError.value = null
  try {
    aiBatch.value = await applyBatch(aiBatch.value.id, selectedProposalIds.value, selectedBatchFields.value)
    selectedProposalIds.value = []
    selectedBatchFields.value = []
    batchConfirmationOpen.value = false
    await load(page.value)
  }
  catch (e: unknown) {
    aiBatchError.value = errorMessage(e, 'The approved batch changes could not be applied.')
  }
  finally {
    aiBatchBusy.value = false
  }
}

onMounted(async () => {
  await load(page.value)
  try {
    await refreshScreenshotStatus()
  }
  catch {
    screenshotStatus.value = null
  }
})
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-brand-fg">
        Listings
      </h1>
      <Button as-child>
        <NuxtLink to="/submit">
          Add by URL
        </NuxtLink>
      </Button>
    </div>

    <section class="mt-6 rounded-xl border border-brand-border bg-white/[0.03] p-4">
      <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div class="text-xs font-semibold uppercase tracking-[0.24em] text-brand-muted">
            Founding screenshots
          </div>
          <p class="mt-1 max-w-2xl text-sm text-brand-muted">
            Runs inside Railway, writes thumbnails to Cloudflare R2, and only picks listings without a public screenshot.
          </p>
          <p v-if="screenshotMessage" class="mt-2 text-sm text-brand-accent">
            {{ screenshotMessage }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" :disabled="screenshotBusy" @click="startScreenshotBatch(true)">
            <AppSpinner v-if="screenshotBusy" class="mr-2" size="sm" label="Starting dry run" />
            Dry run 50
          </Button>
          <Button :disabled="screenshotBusy" @click="startScreenshotBatch(false)">
            <AppSpinner v-if="screenshotBusy" class="mr-2" size="sm" color="text-current" label="Starting batch" />
            Run 50 screenshots
          </Button>
          <Button variant="ghost" :disabled="screenshotBusy" @click="refreshScreenshotStatus">
            Refresh log
          </Button>
        </div>
      </div>
      <div v-if="screenshotStatus?.log_file" class="mt-4 rounded-lg border border-brand-border bg-black/20 p-3">
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-muted">
          <span>{{ screenshotStatus.log_file }}</span>
          <span>{{ screenshotStatus.modified_at }}</span>
        </div>
        <pre class="mt-3 max-h-52 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-brand-muted">{{ screenshotStatus.tail.join('\n') }}</pre>
      </div>
    </section>

    <section class="mt-6 overflow-hidden rounded-2xl border border-brand-accent/30 bg-[linear-gradient(135deg,rgba(99,102,241,0.11),rgba(255,255,255,0.025)_58%,rgba(16,185,129,0.04))]">
      <div class="flex flex-col gap-5 border-b border-brand-border p-5 lg:flex-row lg:items-start lg:justify-between">
        <div class="flex max-w-3xl items-start gap-3">
          <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-brand-accent/25 bg-brand-accent/10 text-brand-accent"><FileDiff class="size-5" aria-hidden="true" /></span>
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-accent">AI enrichment review queue</p>
            <h2 class="mt-1 text-xl font-semibold text-brand-fg">Generate a dry run, then approve exact changes</h2>
            <p class="mt-2 text-sm leading-6 text-brand-muted">Generation never edits a listing. Applying requires a second confirmation with selected proposals and fields.</p>
          </div>
        </div>
        <div class="flex flex-wrap items-end gap-3">
          <label class="space-y-1 text-xs text-brand-muted">
            <span class="block">Listings in dry run</span>
            <input v-model.number="aiBatchLimit" type="number" min="1" max="100" class="h-10 w-28 rounded-md border border-brand-border bg-black/20 px-3 text-sm text-brand-fg outline-none focus-visible:border-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent/30">
          </label>
          <Button type="button" :disabled="aiBatchBusy || aiBatch?.status === 'queued' || aiBatch?.status === 'running'" @click="startAiDryRun">
            <AppSpinner v-if="aiBatchBusy && !batchConfirmationOpen" color="text-current" label="Creating AI dry run" />
            {{ aiBatchBusy && !batchConfirmationOpen ? 'Starting…' : 'Create AI dry run' }}
          </Button>
        </div>
      </div>

      <div v-if="aiBatch" class="p-5">
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-border bg-black/15 px-4 py-3">
          <div>
            <p class="text-sm font-medium text-brand-fg">Batch {{ aiBatch.id.slice(0, 8) }} · {{ aiBatch.status }}</p>
            <p class="mt-1 text-xs text-brand-muted">{{ aiBatch.completed }}/{{ aiBatch.total }} generated · {{ aiBatch.failed }} failed · {{ aiBatch.applied }} applied</p>
          </div>
          <span class="inline-flex items-center gap-2 rounded-full border border-brand-success/25 bg-brand-success/[0.07] px-3 py-1.5 text-xs text-brand-success"><ShieldCheck class="size-3.5" aria-hidden="true" /> No automatic writes</span>
        </div>

        <div v-if="['queued', 'running'].includes(aiBatch.status)" class="mt-4 rounded-xl border border-brand-accent/25 bg-brand-accent/[0.06] p-4" aria-live="polite" aria-busy="true">
          <div class="flex items-center gap-3"><AppSpinner label="Generating dry-run proposals" /><p class="text-sm text-brand-muted">Generating proposals in the background. Listings remain unchanged.</p></div>
        </div>

        <template v-else-if="selectableProposals.length">
          <div class="mt-5 grid gap-3 xl:grid-cols-2">
            <button
              v-for="proposal in selectableProposals"
              :key="proposal.id"
              type="button"
              role="checkbox"
              :aria-checked="selectedProposalIds.includes(proposal.id)"
              class="rounded-xl border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-accent/60"
              :class="selectedProposalIds.includes(proposal.id) ? 'border-brand-accent/55 bg-brand-accent/[0.08]' : 'border-brand-border bg-black/10 hover:border-white/20'"
              @click="toggleProposal(proposal.id)"
            >
              <span class="flex items-start gap-3">
                <span class="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md border" :class="selectedProposalIds.includes(proposal.id) ? 'border-brand-accent bg-brand-accent text-white' : 'border-white/20 text-transparent'"><Check class="size-3.5" aria-hidden="true" /></span>
                <span class="min-w-0">
                  <span class="block truncate text-sm font-semibold text-brand-fg">{{ proposal.current.name || proposal.current.title || proposal.listing_id }}</span>
                  <span class="mt-1 block text-xs leading-5 text-brand-muted">→ {{ proposal.proposed.name || proposal.proposed.title || 'No name change' }}</span>
                  <span v-if="proposal.category.name" class="mt-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-medium" :class="proposal.category.requires_approval ? 'border-brand-warning/30 text-brand-warning' : 'border-brand-success/25 text-brand-success'">{{ proposal.category.requires_approval ? 'New category proposal' : 'Existing category' }} · {{ proposal.category.name }}</span>
                </span>
              </span>
            </button>
          </div>

          <div class="mt-5 rounded-xl border border-brand-border bg-black/10 p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted">Fields to apply to selected proposals</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                v-for="(label, field) in batchFieldLabels"
                :key="field"
                type="button"
                role="checkbox"
                :aria-checked="selectedBatchFields.includes(field)"
                class="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-accent/60"
                :class="selectedBatchFields.includes(field) ? 'border-brand-accent/50 bg-brand-accent/10 text-brand-fg' : 'border-brand-border text-brand-muted hover:text-brand-fg'"
                @click="toggleBatchField(field)"
              ><Check class="size-3.5" :class="selectedBatchFields.includes(field) ? 'text-brand-accent' : 'text-transparent'" aria-hidden="true" />{{ label }}</button>
            </div>
            <p v-if="categorySelectionBlocked" class="mt-3 text-xs leading-5 text-brand-warning" role="alert">At least one selected proposal needs a new category. Approve those individually before applying category changes in a batch.</p>

            <div v-if="batchConfirmationOpen" class="mt-4 rounded-xl border border-brand-warning/35 bg-brand-warning/[0.07] p-4" role="alert">
              <p class="font-medium text-brand-fg">Confirm {{ selectedProposalIds.length }} listing updates</p>
              <p class="mt-1 text-sm leading-6 text-brand-muted">Review every current → proposed value below. Only {{ selectedBatchFields.map(field => batchFieldLabels[field]).join(', ') }} will change after the final click.</p>
              <div class="mt-4 max-h-[34rem] space-y-4 overflow-y-auto pr-1">
                <article v-for="proposal in selectedProposals" :key="proposal.id" class="overflow-hidden rounded-xl border border-brand-border bg-[#0A0E1A]/85">
                  <header class="border-b border-brand-border px-4 py-3">
                    <p class="truncate text-sm font-semibold text-brand-fg">{{ proposal.current.name || proposal.current.title || proposal.listing_id }}</p>
                    <p class="mt-1 font-mono text-[10px] text-brand-muted">Proposal {{ proposal.id.slice(0, 8) }} · listing {{ proposal.listing_id.slice(0, 8) }}</p>
                  </header>
                  <div class="divide-y divide-brand-border">
                    <section v-for="field in selectedBatchFields" :key="field" class="p-4">
                      <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-accent">{{ batchFieldLabels[field] }}</p>
                      <div class="mt-3 grid gap-3 lg:grid-cols-2">
                        <div class="rounded-lg border border-brand-border bg-black/15 p-3">
                          <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">Current</p>
                          <img v-if="field === 'logo_url' && aiFieldLinks(proposalPayload(proposal, 'current'), field)[0]" :src="aiFieldLinks(proposalPayload(proposal, 'current'), field)[0]" alt="Current listing logo" class="mt-2 size-12 rounded-lg border border-brand-border bg-white/5 object-contain p-1">
                          <div v-if="field === 'social_links' && aiFieldLinks(proposalPayload(proposal, 'current'), field).length" class="mt-2 space-y-1">
                            <a v-for="url in aiFieldLinks(proposalPayload(proposal, 'current'), field)" :key="url" :href="url" target="_blank" rel="noopener noreferrer" class="block break-all text-xs leading-5 text-brand-muted underline decoration-white/20 underline-offset-4 hover:text-brand-fg">{{ url }}</a>
                          </div>
                          <a v-else-if="field === 'logo_url' && aiFieldLinks(proposalPayload(proposal, 'current'), field)[0]" :href="aiFieldLinks(proposalPayload(proposal, 'current'), field)[0]" target="_blank" rel="noopener noreferrer" class="mt-2 block break-all text-[11px] leading-5 text-brand-muted underline decoration-white/20 underline-offset-4 hover:text-brand-fg">{{ aiFieldLinks(proposalPayload(proposal, 'current'), field)[0] }}</a>
                          <p v-else class="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-brand-muted">{{ aiFieldDisplayValue(proposalPayload(proposal, 'current'), field) }}</p>
                        </div>
                        <div class="rounded-lg border border-brand-accent/25 bg-brand-accent/[0.06] p-3">
                          <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-accent">Proposed</p>
                          <img v-if="field === 'logo_url' && aiFieldLinks(proposalPayload(proposal, 'proposed'), field)[0]" :src="aiFieldLinks(proposalPayload(proposal, 'proposed'), field)[0]" alt="Proposed listing logo" class="mt-2 size-12 rounded-lg border border-brand-accent/25 bg-white/5 object-contain p-1">
                          <div v-if="field === 'social_links' && aiFieldLinks(proposalPayload(proposal, 'proposed'), field).length" class="mt-2 space-y-1">
                            <a v-for="url in aiFieldLinks(proposalPayload(proposal, 'proposed'), field)" :key="url" :href="url" target="_blank" rel="noopener noreferrer" class="block break-all text-xs leading-5 text-brand-fg underline decoration-brand-accent/35 underline-offset-4 hover:text-brand-accent">{{ url }}</a>
                          </div>
                          <a v-else-if="field === 'logo_url' && aiFieldLinks(proposalPayload(proposal, 'proposed'), field)[0]" :href="aiFieldLinks(proposalPayload(proposal, 'proposed'), field)[0]" target="_blank" rel="noopener noreferrer" class="mt-2 block break-all text-[11px] leading-5 text-brand-fg underline decoration-brand-accent/35 underline-offset-4 hover:text-brand-accent">{{ aiFieldLinks(proposalPayload(proposal, 'proposed'), field)[0] }}</a>
                          <p v-else class="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-brand-fg">{{ aiFieldDisplayValue(proposalPayload(proposal, 'proposed'), field) }}</p>
                        </div>
                      </div>
                    </section>
                  </div>
                </article>
              </div>
            </div>
            <div class="mt-4 flex flex-wrap justify-end gap-3">
              <Button v-if="batchConfirmationOpen" type="button" variant="ghost" :disabled="aiBatchBusy" @click="batchConfirmationOpen = false">Review again</Button>
              <Button type="button" :disabled="!canApplyBatch" @click="applySelectedBatch">
                <AppSpinner v-if="aiBatchBusy" color="text-current" label="Applying approved AI changes" />
                {{ batchConfirmationOpen ? `Apply ${selectedProposalIds.length} approved proposals` : 'Review selected changes' }}
              </Button>
            </div>
          </div>
        </template>
        <p v-else class="mt-4 rounded-xl border border-brand-border bg-black/10 p-5 text-sm text-brand-muted">This dry run produced no pending proposals.</p>
      </div>
      <p v-if="aiBatchError" class="border-t border-brand-border px-5 py-4 text-sm text-brand-warning" role="alert">{{ aiBatchError }}</p>
    </section>

    <!-- Filters -->
    <div class="mt-6 flex flex-wrap items-end gap-3">
      <label class="flex flex-col gap-1 text-xs text-brand-muted">
        Status
        <select v-model="filters.status" class="rounded-md border border-brand-border bg-transparent px-2 py-1.5 text-sm text-brand-fg" @change="load(1)">
          <option value="">All</option>
          <option value="published">Published</option>
          <option value="pending_review">Pending review</option>
          <option value="draft">Draft</option>
          <option value="rejected">Rejected</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-brand-muted">
        Tier
        <select v-model="filters.tier" class="rounded-md border border-brand-border bg-transparent px-2 py-1.5 text-sm text-brand-fg" @change="load(1)">
          <option value="">All</option>
          <option value="basic">Standard</option>
          <option value="featured">Featured</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-brand-muted">
        Source
        <select v-model="filters.source" class="rounded-md border border-brand-border bg-transparent px-2 py-1.5 text-sm text-brand-fg" @change="load(1)">
          <option value="">All</option>
          <option value="founding">Founding</option>
          <option value="customer">Customer</option>
          <option value="admin">Admin</option>
          <option value="seed">Seed</option>
        </select>
      </label>
      <label class="flex flex-1 flex-col gap-1 text-xs text-brand-muted">
        Search
        <input v-model="filters.q" type="search" placeholder="name, url, tagline" class="rounded-md border border-brand-border bg-transparent px-2 py-1.5 text-sm text-brand-fg" @keyup.enter="load(1)">
      </label>
      <Button variant="outline" :disabled="loading" @click="load(1)">
        Apply
      </Button>
    </div>

    <p v-if="error" class="mt-4 text-sm text-red-400">
      {{ error }}
    </p>

    <!-- Table -->
    <div class="mt-6 overflow-x-auto rounded-xl border border-brand-border">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-brand-border text-xs uppercase tracking-wider text-brand-muted">
          <tr>
            <th class="px-4 py-3 font-medium">Name</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium">Tier</th>
            <th class="px-4 py-3 font-medium">Source</th>
            <th class="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-8 text-center text-brand-muted">
              <AppSpinner class="mx-auto" label="Loading listings" />
            </td>
          </tr>
          <tr v-else-if="!listings.length">
            <td colspan="5" class="px-4 py-8 text-center text-brand-muted">
              No listings match.
            </td>
          </tr>
          <tr v-for="l in listings" v-else :key="l.id" class="border-b border-brand-border/60 last:border-0">
            <td class="px-4 py-3">
              <NuxtLink :to="`/admin/listings/${l.id}`" class="font-medium text-brand-fg hover:text-brand-accent">
                {{ l.name }}
              </NuxtLink>
              <div class="truncate text-xs text-brand-muted">{{ l.url }}</div>
            </td>
            <td class="px-4 py-3">
              <span class="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" :class="statusClass[l.status]">
                {{ l.status.replace('_', ' ') }}
              </span>
            </td>
            <td class="px-4 py-3 text-brand-muted">{{ l.tier ?? '—' }}</td>
            <td class="px-4 py-3 text-brand-muted">{{ l.source }}</td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap items-center justify-end gap-1.5">
                <Button size="sm" variant="ghost" as-child>
                  <NuxtLink :to="`/admin/listings/${l.id}`">Edit</NuxtLink>
                </Button>
                <Button v-if="l.status !== 'published'" size="sm" variant="outline" :disabled="!!actionBusy[l.id]" @click="act(l, 'publish')">
                  <AppSpinner v-if="actionBusy[l.id] === 'publish'" class="mr-1.5" size="sm" color="text-current" label="Publishing listing" />
                  {{ actionBusy[l.id] === 'publish' ? 'Publishing…' : 'Publish' }}
                </Button>
                <Button v-if="l.status === 'published'" size="sm" variant="outline" :disabled="!!actionBusy[l.id]" @click="act(l, 'unpublish')">
                  <AppSpinner v-if="actionBusy[l.id] === 'unpublish'" class="mr-1.5" size="sm" color="text-current" label="Unpublishing listing" />
                  {{ actionBusy[l.id] === 'unpublish' ? 'Unpublishing…' : 'Unpublish to pending review' }}
                </Button>
                <Button v-if="l.status !== 'rejected'" size="sm" variant="ghost" class="text-red-400 hover:text-red-300" :disabled="!!actionBusy[l.id]" @click="act(l, 'reject')">
                  <AppSpinner v-if="actionBusy[l.id] === 'reject'" class="mr-1.5" size="sm" color="text-current" label="Rejecting listing" />
                  {{ actionBusy[l.id] === 'reject' ? 'Rejecting…' : 'Reject' }}
                </Button>
              </div>
              <p v-if="actionErrors[l.id]" class="mt-2 text-right text-xs text-red-400" role="alert">
                {{ actionErrors[l.id] }}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pagination" class="mt-4 flex flex-col gap-3 text-sm text-brand-muted sm:flex-row sm:items-center sm:justify-between">
      <p>
        <template v-if="pagination.from !== null && pagination.to !== null">
          Showing {{ pagination.from }}–{{ pagination.to }} of {{ pagination.total }}
        </template>
        <template v-else>
          {{ pagination.total }} listings
        </template>
      </p>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="loading || pagination.current_page <= 1" @click="load(pagination.current_page - 1)">
          Previous
        </Button>
        <span>Page {{ pagination.current_page }} of {{ pagination.last_page }}</span>
        <Button variant="outline" size="sm" :disabled="loading || pagination.current_page >= pagination.last_page" @click="load(pagination.current_page + 1)">
          Next
        </Button>
      </div>
    </div>
  </div>
</template>
