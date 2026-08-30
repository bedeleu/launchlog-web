<script setup lang="ts">
import { ArrowUpRight, CreditCard, FileDiff, LogOut, Save } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CustomerListing, CustomerListingStatus, CustomerListingUpdate } from '~/composables/useCustomerListings'
import type { AiEnrichmentField, AiEnrichmentProposal, AiGenerationQuota } from '~/composables/useAiEnrichment'
import { receiptProofDestinations, receiptUnavailableLabel } from '~/utils/customer-receipt'
import { toErrorLike } from '~/utils/error-like'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Your launches · LaunchLog', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const { user, logout, waitForAuthReady } = useAuth()
const { list, update, billingPortal } = useCustomerListings()
const { listOwnerProposals, generateOwnerProposal, applyOwnerProposal, rejectOwnerProposal } = useAiEnrichment()
const {
  listings,
  drafts,
  actionErrors,
  savingIds,
  billingIds,
  syncListings,
  commitListing,
  isDirty,
  clearPrivateData,
  beginSaving,
  finishSaving,
  beginBilling,
  finishBilling,
  clearSaved,
} = useCustomerDashboardState()

const loading = ref(true)
const error = ref<string | null>(null)
const authReady = ref(false)
const signingOut = ref(false)
const aiProposals = reactive<Record<string, AiEnrichmentProposal | null>>({})
const aiQuotas = reactive<Record<string, AiGenerationQuota | null>>({})
type AiLoadState = 'idle' | 'loading' | 'ready' | 'error'
const aiLoadStates = reactive<Record<string, AiLoadState>>({})
const aiLoadErrors = reactive<Record<string, string | null>>({})
const aiLoadAttempts = new Map<string, number>()
const aiBusyIds = reactive(new Set<string>())
let dashboardGeneration = 0

const statusLabels: Record<CustomerListingStatus, string> = {
  draft: 'Draft',
  pending_review: 'In review',
  published: 'Published',
  archived: 'Archived',
  spam: 'Needs attention',
  rejected: 'Not accepted',
}

const statusState = (status: CustomerListingStatus): 'neutral' | 'success' | 'warning' | 'destructive' => {
  if (status === 'published') return 'success'
  if (status === 'pending_review') return 'warning'
  if (status === 'spam' || status === 'rejected') return 'destructive'
  return 'neutral'
}

function messageFrom(errorValue: unknown, fallback: string): string {
  const value = toErrorLike(errorValue)
  return value.data?.message ?? value.data?.error ?? value.message ?? fallback
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function domainOf(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  }
  catch {
    return value
  }
}

function validateDraft(draft: { name: string, tagline: string, description: string }): string | null {
  const nameLength = draft.name.trim().length
  if (nameLength < 2) return 'Name must contain at least 2 characters.'
  if (nameLength > 120) return 'Name cannot exceed 120 characters.'
  if (draft.tagline.length > 200) return 'Tagline cannot exceed 200 characters.'
  if (draft.description.length > 4000) return 'Description cannot exceed 4,000 characters.'
  return null
}

function aiQuotaSummary(quota: AiGenerationQuota): string {
  const periodEnd = quota.period_end ? formatDate(quota.period_end) : 'the billing period ends'
  return `${quota.used} used · ${quota.remaining} of ${quota.limit} left until ${periodEnd}.`
}

function clearAiState() {
  aiBusyIds.clear()
  aiLoadAttempts.clear()
  for (const key of Object.keys(aiProposals)) Reflect.deleteProperty(aiProposals, key)
  for (const key of Object.keys(aiQuotas)) Reflect.deleteProperty(aiQuotas, key)
  for (const key of Object.keys(aiLoadStates)) Reflect.deleteProperty(aiLoadStates, key)
  for (const key of Object.keys(aiLoadErrors)) Reflect.deleteProperty(aiLoadErrors, key)
}

function pruneAiState(items: CustomerListing[]) {
  const currentIds = new Set(items.map(listing => listing.id))
  const stores = [aiProposals, aiQuotas, aiLoadStates, aiLoadErrors]
  for (const store of stores) {
    for (const key of Object.keys(store)) {
      if (!currentIds.has(key)) Reflect.deleteProperty(store, key)
    }
  }
  for (const key of aiLoadAttempts.keys()) {
    if (!currentIds.has(key)) aiLoadAttempts.delete(key)
  }
}

async function loadAiStateForListing(listing: CustomerListing, generation: number) {
  if (!listing.subscription) {
    aiProposals[listing.id] = null
    aiQuotas[listing.id] = null
    aiLoadStates[listing.id] = 'ready'
    aiLoadErrors[listing.id] = null
    return
  }

  const attempt = (aiLoadAttempts.get(listing.id) ?? 0) + 1
  aiLoadAttempts.set(listing.id, attempt)
  aiLoadStates[listing.id] = 'loading'
  aiLoadErrors[listing.id] = null

  try {
    const result = await listOwnerProposals(listing.id)
    if (generation !== dashboardGeneration || signingOut.value || aiLoadAttempts.get(listing.id) !== attempt) return
    aiQuotas[listing.id] = result.quota
    aiProposals[listing.id] = result.proposals.find(proposal => proposal.status === 'pending') ?? null
    aiLoadStates[listing.id] = 'ready'
  }
  catch (loadError: unknown) {
    if (generation !== dashboardGeneration || signingOut.value || aiLoadAttempts.get(listing.id) !== attempt) return
    aiQuotas[listing.id] = null
    aiProposals[listing.id] = null
    aiLoadStates[listing.id] = 'error'
    aiLoadErrors[listing.id] = messageFrom(loadError, 'AI allowance could not be loaded.')
  }
}

function loadAiState(items: CustomerListing[], generation: number) {
  pruneAiState(items)
  for (const listing of items) void loadAiStateForListing(listing, generation)
}

function retryAiState(listing: CustomerListing) {
  if (aiLoadStates[listing.id] === 'loading') return
  void loadAiStateForListing(listing, dashboardGeneration)
}

async function loadListings() {
  if (signingOut.value) return
  const generation = dashboardGeneration
  loading.value = listings.value.length === 0
  error.value = null
  try {
    const items = await list()
    if (generation !== dashboardGeneration || signingOut.value) return
    syncListings(items)
    loading.value = false
    loadAiState(items, generation)
  }
  catch (loadError: unknown) {
    if (generation !== dashboardGeneration || signingOut.value) return
    error.value = messageFrom(loadError, 'Your listings could not be loaded.')
  }
  finally {
    if (generation === dashboardGeneration && !signingOut.value) loading.value = false
  }
}

async function save(listing: CustomerListing) {
  const generation = dashboardGeneration
  const draft = drafts[listing.id]
  if (!draft) return
  if (!isDirty(listing.id) || savingIds.has(listing.id)) return

  const validationError = validateDraft(draft)
  actionErrors[listing.id] = validationError
  if (validationError) return

  const fields: CustomerListingUpdate = {
    name: draft.name.trim(),
    tagline: draft.tagline.trim() || null,
    description: draft.description.trim() || null,
  }

  beginSaving(listing.id)
  clearSaved(listing.id)
  try {
    const updated = await update(listing.id, fields)
    if (generation !== dashboardGeneration || signingOut.value) return
    commitListing(updated)
  }
  catch (saveError: unknown) {
    if (generation !== dashboardGeneration || signingOut.value) return
    actionErrors[listing.id] = messageFrom(saveError, 'Your changes could not be saved.')
  }
  finally {
    finishSaving(listing.id)
  }
}

async function manageBilling(listing: CustomerListing) {
  const generation = dashboardGeneration
  beginBilling(listing.id)
  actionErrors[listing.id] = null
  try {
    const url = await billingPortal(listing.id)
    if (generation !== dashboardGeneration || signingOut.value) return
    await navigateTo(url, { external: true })
  }
  catch (billingError: unknown) {
    if (generation !== dashboardGeneration || signingOut.value) return
    actionErrors[listing.id] = messageFrom(billingError, 'Billing could not be opened.')
  }
  finally {
    finishBilling(listing.id)
  }
}

async function generateAiDraft(listing: CustomerListing) {
  const quota = aiQuotas[listing.id]
  if (aiBusyIds.has(listing.id) || aiProposals[listing.id]) return
  if (aiLoadStates[listing.id] !== 'ready' || !listing.subscription || !quota?.eligible || quota.remaining === 0) return
  aiBusyIds.add(listing.id)
  actionErrors[listing.id] = null
  try {
    const result = await generateOwnerProposal(listing.id)
    aiProposals[listing.id] = result.proposal
    aiQuotas[listing.id] = result.quota
    aiLoadStates[listing.id] = 'ready'
  }
  catch (proposalError: unknown) {
    actionErrors[listing.id] = messageFrom(proposalError, 'The grounded AI draft could not be prepared.')
  }
  finally {
    aiBusyIds.delete(listing.id)
  }
}

async function applyAiDraft(listing: CustomerListing, fields: AiEnrichmentField[]) {
  const proposal = aiProposals[listing.id]
  if (!proposal || aiBusyIds.has(listing.id)) return
  aiBusyIds.add(listing.id)
  actionErrors[listing.id] = null
  try {
    await applyOwnerProposal(proposal.id, fields)
    aiProposals[listing.id] = null
    await loadListings()
  }
  catch (proposalError: unknown) {
    actionErrors[listing.id] = messageFrom(proposalError, 'The selected suggestions could not be applied.')
  }
  finally {
    aiBusyIds.delete(listing.id)
  }
}

async function rejectAiDraft(listing: CustomerListing) {
  const proposal = aiProposals[listing.id]
  if (!proposal || aiBusyIds.has(listing.id)) return
  aiBusyIds.add(listing.id)
  actionErrors[listing.id] = null
  try {
    await rejectOwnerProposal(proposal.id)
    aiProposals[listing.id] = null
  }
  catch (proposalError: unknown) {
    actionErrors[listing.id] = messageFrom(proposalError, 'The draft could not be dismissed.')
  }
  finally {
    aiBusyIds.delete(listing.id)
  }
}

async function signOut() {
  if (signingOut.value) return
  signingOut.value = true
  dashboardGeneration += 1
  clearPrivateData()
  clearAiState()
  error.value = null
  try {
    await logout()
  }
  finally {
    await navigateTo('/login')
  }
}

onMounted(async () => {
  await waitForAuthReady()
  if (signingOut.value) return
  authReady.value = true
  await loadListings()
})
/**
 * Customer-facing plan names: the internal identifier `basic` sells as Standard,
 * `featured` as Featured. An unrecognised tier falls through to its raw value
 * rather than being renamed into something the customer never bought.
 */
const tierLabel = (tier: string | null | undefined): string => {
  if (tier === 'basic') return 'Standard'
  if (tier === 'featured') return 'Featured'
  return tier ?? ''
}
</script>

<template>
  <div class="min-h-[calc(100vh-5rem)] bg-release-ink">
    <ReleaseShell
      title="Your release shelf"
      description="Maintain the public copy, billing record, and verifiable artifacts for every release you own."
      wide-rail
    >
      <template #rail>
        <div class="hidden xl:block">
          <ReleaseActionRail
            title="Account holder"
            :description="authReady && user?.email ? user.email : 'Verifying signed-in account…'"
          >
            <ReleaseStateMarker
              label="Private workspace"
              detail="Only releases attached to this signed-in account appear here."
              state="success"
            />
            <Button
              class="w-full rounded-none border-release-seam bg-release-ink font-mono text-xs uppercase tracking-[0.08em] text-release-paper hover:border-release-paper hover:bg-release-rail"
              variant="outline"
              :disabled="signingOut"
              @click="signOut"
            >
              <AppSpinner v-if="signingOut" color="text-current" label="Signing out" />
              <LogOut v-else aria-hidden="true" />
              {{ signingOut ? 'Signing out…' : 'Sign out' }}
            </Button>
            <template #footer>
              <NuxtLink
                to="/submit"
                class="flex min-h-12 items-center justify-between border border-release-paper bg-release-paper px-4 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-release-ink transition-colors hover:border-release-warning hover:bg-release-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus"
              >
                Record another release
                <ArrowUpRight class="size-4" aria-hidden="true" />
              </NuxtLink>
            </template>
          </ReleaseActionRail>
        </div>
      </template>

      <section data-mobile-account-actions class="mb-6 border border-release-seam bg-release-rail p-4 xl:hidden" aria-label="Account actions">
        <p class="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-release-warning">Private workspace</p>
        <p class="mt-2 break-all text-sm text-release-paper-muted">{{ authReady && user?.email ? user.email : 'Verifying signed-in account…' }}</p>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <NuxtLink
            to="/submit"
            class="flex min-h-11 items-center justify-between border border-release-paper bg-release-paper px-4 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-release-ink transition-colors hover:border-release-warning hover:bg-release-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus"
          >
            Record another release
            <ArrowUpRight class="size-4" aria-hidden="true" />
          </NuxtLink>
          <Button
            class="min-h-11 rounded-none border-release-seam bg-release-ink font-mono text-xs uppercase tracking-[0.08em] text-release-paper hover:border-release-paper hover:bg-release-rail"
            variant="outline"
            :disabled="signingOut"
            @click="signOut"
          >
            <AppSpinner v-if="signingOut" color="text-current" label="Signing out" />
            <LogOut v-else aria-hidden="true" />
            {{ signingOut ? 'Signing out…' : 'Sign out' }}
          </Button>
        </div>
      </section>

      <section v-if="loading" class="border border-release-seam bg-release-rail px-6 py-14 text-center" aria-live="polite">
        <AppSpinner class="mx-auto" size="size-6" label="Loading release shelf" />
        <p class="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-release-paper-muted">
          Loading release shelf
        </p>
      </section>

      <section v-else-if="error" class="border border-release-destructive border-l-2 bg-release-rail p-6" role="alert">
        <h2 class="text-xl font-semibold text-release-paper">
          Release shelf unavailable
        </h2>
        <p class="mt-2 text-sm leading-6 text-release-paper-muted">
          {{ error }}
        </p>
        <Button class="mt-5 rounded-none border-release-paper bg-release-paper text-release-ink hover:bg-release-warning" @click="loadListings">
          Try again
        </Button>
      </section>

      <section v-else-if="!listings.length" class="border border-release-seam bg-release-rail px-6 py-14 text-center">
        <p class="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-release-warning">
          No releases recorded
        </p>
        <h2 class="mt-4 text-2xl font-semibold tracking-[-0.025em] text-release-paper">
          Your first release starts with one public URL.
        </h2>
        <p class="mx-auto mt-3 max-w-lg text-sm leading-6 text-release-paper-muted">
          LaunchLog captures the page, prepares the public copy, and waits for your approval before anything is published.
        </p>
      </section>

      <div v-else class="space-y-10">
        <article
          v-for="listing in listings"
          :key="listing.id"
          data-customer-release
          class="border border-release-seam bg-release-ink"
        >
          <header class="grid border-b border-release-seam lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div class="min-w-0 p-5 sm:p-7">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[0.64rem] font-semibold uppercase tracking-[0.16em]">
                <span class="text-release-blaze">Release record</span>
                <span class="text-release-paper-muted">{{ domainOf(listing.url) }}</span>
              </div>
              <h2 class="mt-4 max-w-[32ch] text-2xl font-semibold tracking-[-0.03em] text-release-paper sm:text-3xl">
                {{ listing.name }}
              </h2>
              <a
                :href="listing.url"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-3 inline-flex max-w-full items-center gap-2 break-all font-mono text-xs text-release-paper-muted underline-offset-4 transition-colors hover:text-release-blaze hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus"
              >
                {{ listing.url }}
                <ArrowUpRight class="size-3.5 shrink-0" aria-hidden="true" />
              </a>
            </div>

            <div class="border-t border-release-seam bg-release-paper p-5 text-release-ink sm:p-7 lg:border-l lg:border-t-0">
              <p class="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-release-ink/60">
                Publication state
              </p>
              <p class="mt-3 text-xl font-semibold tracking-[-0.02em]">
                {{ statusLabels[listing.status] }}
              </p>
              <p class="mt-2 font-mono text-xs uppercase tracking-[0.1em] text-release-ink/65">
                {{ listing.published_at ? `Recorded ${formatDate(listing.published_at)}` : 'Awaiting publication' }}
              </p>
            </div>
          </header>

          <dl class="grid border-b border-release-seam bg-release-seam sm:grid-cols-2 xl:grid-cols-4">
            <div class="bg-release-ink p-4 sm:p-5">
              <dt class="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-release-paper-muted">Publication state</dt>
              <dd class="mt-3"><ReleaseStateMarker :label="statusLabels[listing.status]" :state="statusState(listing.status)" /></dd>
            </div>
            <div class="border-t border-release-seam bg-release-ink p-4 sm:border-l sm:border-t-0 sm:p-5">
              <dt class="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-release-paper-muted">Catalog edition</dt>
              <dd class="mt-3 text-sm font-medium text-release-paper">{{ listing.tier ? tierLabel(listing.tier) : 'Unassigned' }}</dd>
              <dd class="mt-1 text-xs text-release-paper-muted">{{ listing.expires_at ? `Expires ${formatDate(listing.expires_at)}` : 'No edition expiry recorded' }}</dd>
            </div>
            <div class="border-t border-release-seam bg-release-ink p-4 sm:p-5 xl:border-l xl:border-t-0">
              <dt class="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-release-paper-muted">Billing record</dt>
              <template v-if="listing.subscription">
                <dd class="mt-3 text-sm font-medium capitalize text-release-paper">{{ listing.subscription.status.replace('_', ' ') }}</dd>
                <dd class="mt-1 text-xs text-release-paper-muted">{{ tierLabel(listing.subscription.tier) }} subscription</dd>
              </template>
              <dd v-else class="mt-3 text-sm text-release-paper-muted">No paid subscription attached</dd>
            </div>
            <div class="border-t border-release-seam bg-release-ink p-4 sm:border-l sm:p-5 xl:border-t-0">
              <dt class="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-release-paper-muted">Renewal / expiry</dt>
              <dd class="mt-3 text-sm font-medium text-release-paper">
                {{ listing.subscription ? formatDate(listing.subscription.canceled_at ?? listing.subscription.current_period_end) : formatDate(listing.expires_at) }}
              </dd>
              <dd class="mt-1 text-xs text-release-paper-muted">{{ listing.subscription?.canceled_at ? 'Canceled' : 'Current catalog term' }}</dd>
            </div>
          </dl>

          <div class="grid xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
            <form class="min-w-0 p-5 sm:p-7" @submit.prevent="save(listing)">
              <div class="flex flex-col gap-4 border-b border-release-seam pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 class="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-release-paper">Public copy</h3>
                  <p class="mt-2 max-w-xl text-sm leading-6 text-release-paper-muted">Edit only the text visitors should see. Nothing moves until you save.</p>
                </div>
                <div v-if="listing.subscription" class="w-full shrink-0 sm:w-auto sm:max-w-xs sm:text-right">
                  <div
                    v-if="aiLoadStates[listing.id] === 'loading' || !aiLoadStates[listing.id]"
                    data-ai-quota-state="loading"
                    class="flex min-h-10 items-center gap-2 border border-release-seam bg-release-rail px-3 py-2 sm:justify-end"
                    role="status"
                    aria-live="polite"
                  >
                    <AppSpinner size="size-4" label="Checking AI allowance" />
                    <span class="text-xs text-release-paper-muted">Checking AI allowance…</span>
                  </div>

                  <div
                    v-else-if="aiLoadStates[listing.id] === 'error'"
                    data-ai-quota-state="error"
                    class="border border-release-destructive bg-release-rail px-3 py-3 text-left"
                    role="alert"
                  >
                    <p class="text-sm font-semibold text-release-paper">AI allowance unavailable</p>
                    <p class="mt-1 text-xs leading-5 text-release-paper-muted">{{ aiLoadErrors[listing.id] }}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      class="mt-3 rounded-none border-release-seam bg-release-ink font-mono text-xs text-release-paper hover:border-release-paper hover:bg-release-rail"
                      @click="retryAiState(listing)"
                    >
                      Retry AI allowance
                    </Button>
                  </div>

                  <div
                    v-else-if="aiProposals[listing.id]"
                    data-ai-proposal-status="ready"
                    class="border border-release-warning/55 bg-release-warning/[0.05] px-3 py-3 text-left"
                    role="status"
                  >
                    <p class="flex items-center gap-2 text-sm font-semibold text-release-paper">
                      <FileDiff class="size-4 text-release-warning" aria-hidden="true" />
                      AI draft ready for review
                    </p>
                    <p class="mt-1 text-xs leading-5 text-release-paper-muted">Review the proposed changes directly below.</p>
                    <p v-if="aiQuotas[listing.id]" class="mt-2 font-mono text-[0.65rem] leading-5 text-release-paper-muted">
                      {{ aiQuotaSummary(aiQuotas[listing.id]!) }}
                    </p>
                  </div>

                  <div v-else-if="aiQuotas[listing.id]?.eligible">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      class="rounded-none border-release-seam bg-release-rail font-mono text-xs text-release-paper hover:border-release-paper hover:bg-release-ink"
                      :disabled="aiBusyIds.has(listing.id) || aiQuotas[listing.id]!.remaining === 0"
                      @click="generateAiDraft(listing)"
                    >
                      <AppSpinner v-if="aiBusyIds.has(listing.id)" color="text-current" label="Preparing grounded draft" />
                      <FileDiff v-else aria-hidden="true" />
                      <template v-if="aiBusyIds.has(listing.id)">Preparing…</template>
                      <template v-else-if="aiQuotas[listing.id]!.remaining === 0">AI limit reached</template>
                      <template v-else>Improve with AI</template>
                    </Button>
                    <p class="mt-2 font-mono text-[0.65rem] leading-5 text-release-paper-muted">
                      {{ aiQuotaSummary(aiQuotas[listing.id]!) }}
                    </p>
                    <p v-if="aiQuotas[listing.id]!.remaining === 0" class="mt-1 text-xs leading-5 text-release-paper-muted">
                      Manual editing stays available.
                    </p>
                  </div>

                  <div v-else class="border border-release-seam bg-release-rail px-3 py-3 text-left" role="status">
                    <p class="text-sm font-semibold text-release-paper">AI edits unavailable</p>
                    <p class="mt-1 text-xs leading-5 text-release-paper-muted">Manual editing stays available for this release.</p>
                  </div>
                </div>
              </div>

              <AiProposalReview
                v-if="aiProposals[listing.id]"
                class="mt-6"
                :current="aiProposals[listing.id]!.current"
                :proposed="aiProposals[listing.id]!.proposed"
                :evidence="aiProposals[listing.id]!.evidence"
                :category-requires-approval="aiProposals[listing.id]!.category.requires_approval"
                :busy="aiBusyIds.has(listing.id)"
                mode="owner"
                @apply="fields => applyAiDraft(listing, fields)"
                @reject="rejectAiDraft(listing)"
              />
              <p v-if="aiProposals[listing.id] && actionErrors[listing.id]" class="mt-3 border-l-2 border-release-destructive bg-release-rail px-4 py-3 text-sm text-release-destructive" role="alert">
                {{ actionErrors[listing.id] }}
              </p>

              <div v-if="drafts[listing.id] && !aiProposals[listing.id]" class="mt-6 space-y-5">
                <div class="space-y-2">
                  <Label :for="`listing-${listing.id}-name`" class="font-mono text-xs text-release-paper">Name</Label>
                  <Input :id="`listing-${listing.id}-name`" v-model="drafts[listing.id]!.name" minlength="2" maxlength="120" required :disabled="savingIds.has(listing.id)" class="h-11 rounded-none border-release-seam bg-release-rail text-release-paper focus-visible:border-release-warning focus-visible:ring-release-focus" @input="clearSaved(listing.id)" />
                </div>
                <div class="space-y-2">
                  <Label :for="`listing-${listing.id}-tagline`" class="font-mono text-xs text-release-paper">Tagline</Label>
                  <Input :id="`listing-${listing.id}-tagline`" v-model="drafts[listing.id]!.tagline" maxlength="200" :disabled="savingIds.has(listing.id)" class="h-11 rounded-none border-release-seam bg-release-rail text-release-paper focus-visible:border-release-warning focus-visible:ring-release-focus" @input="clearSaved(listing.id)" />
                </div>
                <div class="space-y-2">
                  <div class="flex items-center justify-between gap-4">
                    <Label :for="`listing-${listing.id}-description`" class="font-mono text-xs text-release-paper">Description</Label>
                    <span class="font-mono text-[0.65rem] text-release-paper-muted">{{ drafts[listing.id]!.description.length }}/4000</span>
                  </div>
                  <textarea :id="`listing-${listing.id}-description`" v-model="drafts[listing.id]!.description" maxlength="4000" rows="6" :disabled="savingIds.has(listing.id)" class="w-full resize-y border border-release-seam bg-release-rail px-3 py-2.5 text-sm leading-6 text-release-paper outline-none transition-[border-color,box-shadow] placeholder:text-release-paper-muted focus-visible:border-release-warning focus-visible:ring-2 focus-visible:ring-release-focus disabled:cursor-not-allowed disabled:opacity-50" @input="clearSaved(listing.id)" />
                </div>
              </div>

              <div v-if="!aiProposals[listing.id]" class="mt-6 grid min-h-12 items-start gap-3 border-t border-release-seam pt-5 sm:grid-cols-[auto_minmax(0,1fr)]">
                <Button type="submit" size="lg" class="rounded-none border border-release-paper bg-release-paper text-release-ink hover:border-release-warning hover:bg-release-warning" :disabled="savingIds.has(listing.id) || !isDirty(listing.id)">
                  <AppSpinner v-if="savingIds.has(listing.id)" color="text-current" label="Saving listing" />
                  <Save v-else aria-hidden="true" />
                  {{ savingIds.has(listing.id) ? 'Saving…' : 'Save details' }}
                </Button>
                <div class="min-h-10 py-1 text-xs leading-5" aria-live="polite" aria-atomic="true">
                  <p v-if="savingIds.has(listing.id)" class="text-release-paper-muted" role="status">Saving changes</p>
                  <p v-else-if="actionErrors[listing.id]" class="text-release-destructive" role="alert">{{ actionErrors[listing.id] }}</p>
                </div>
              </div>
            </form>

            <section class="border-t border-release-seam bg-release-rail p-5 sm:p-7 xl:border-l xl:border-t-0" :aria-labelledby="`receipt-${listing.id}`">
              <h3 :id="`receipt-${listing.id}`" class="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-release-paper">Published proof</h3>
              <p class="mt-2 text-sm leading-6 text-release-paper-muted">Four direct artifacts from the current publication state. Each address is independently checkable.</p>
              <div class="mt-5 divide-y divide-release-seam border-y border-release-seam">
                <template v-for="destination in receiptProofDestinations(listing.receipt)" :key="destination.key">
                  <ListingReceiptArtifact v-if="listing.receipt.checks[destination.key]" :destination="destination" />
                  <div v-else class="py-4">
                    <ReleaseStateMarker :label="destination.label" :detail="receiptUnavailableLabel(listing.status)" state="neutral" />
                  </div>
                </template>
              </div>

              <Button v-if="listing.subscription" class="mt-6 w-full rounded-none border-release-seam bg-release-ink font-mono text-xs text-release-paper hover:border-release-paper hover:bg-release-rail" variant="outline" :disabled="billingIds.has(listing.id)" @click="manageBilling(listing)">
                <AppSpinner v-if="billingIds.has(listing.id)" color="text-current" label="Opening billing" />
                <CreditCard v-else aria-hidden="true" />
                {{ billingIds.has(listing.id) ? 'Opening billing…' : 'Manage billing' }}
              </Button>
            </section>
          </div>
        </article>
      </div>
    </ReleaseShell>
  </div>
</template>
