<script setup lang="ts">
import { Check, CircleDashed, CreditCard, ExternalLink, LogOut, Save } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CustomerListing, CustomerListingStatus, CustomerListingUpdate } from '~/composables/useCustomerListings'
import { receiptUnavailableLabel } from '~/utils/customer-receipt'
import { toErrorLike } from '~/utils/error-like'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Your launches · LaunchLog', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const { user, logout, waitForAuthReady } = useAuth()
const { list, update, billingPortal } = useCustomerListings()
const {
  listings,
  drafts,
  actionErrors,
  savingIds,
  billingIds,
  savedIds,
  syncDraft,
  syncListings,
  clearPrivateData,
  beginSaving,
  finishSaving,
  beginBilling,
  finishBilling,
  markSaved,
  clearSaved,
} = useCustomerDashboardState()

const loading = ref(true)
const error = ref<string | null>(null)
const authReady = ref(false)
const signingOut = ref(false)
let dashboardGeneration = 0

const statusLabels: Record<CustomerListingStatus, string> = {
  draft: 'Draft',
  pending_review: 'In review',
  published: 'Published',
  archived: 'Archived',
  spam: 'Needs attention',
  rejected: 'Not accepted',
}

const statusClasses: Record<CustomerListingStatus, string> = {
  draft: 'border-white/10 bg-white/[0.04] text-brand-muted',
  pending_review: 'border-brand-warning/30 bg-brand-warning/10 text-brand-warning',
  published: 'border-brand-success/30 bg-brand-success/10 text-brand-success',
  archived: 'border-white/10 bg-white/[0.04] text-brand-muted',
  spam: 'border-red-400/30 bg-red-400/10 text-red-300',
  rejected: 'border-red-400/30 bg-red-400/10 text-red-300',
}

const receiptRows = [
  { key: 'published' as const, label: 'Public listing', linkKey: 'public_url' as const },
  { key: 'schema' as const, label: 'Structured data', linkKey: 'public_url' as const },
  { key: 'markdown' as const, label: 'Markdown response', linkKey: 'markdown_url' as const },
  { key: 'llms' as const, label: 'AI discovery feed', linkKey: 'llms_url' as const },
]

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

function validateDraft(draft: { name: string, tagline: string, description: string }): string | null {
  const nameLength = draft.name.trim().length
  if (nameLength < 2) return 'Name must contain at least 2 characters.'
  if (nameLength > 120) return 'Name cannot exceed 120 characters.'
  if (draft.tagline.length > 200) return 'Tagline cannot exceed 200 characters.'
  if (draft.description.length > 4000) return 'Description cannot exceed 4,000 characters.'
  return null
}

async function loadListings() {
  if (signingOut.value) return
  const generation = dashboardGeneration
  loading.value = true
  error.value = null
  try {
    const items = await list()
    if (generation !== dashboardGeneration || signingOut.value) return
    syncListings(items)
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
    const index = listings.value.findIndex(item => item.id === listing.id)
    if (index !== -1) listings.value[index] = updated
    syncDraft(updated)
    markSaved(listing.id)
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

async function signOut() {
  if (signingOut.value) return
  signingOut.value = true
  dashboardGeneration += 1
  clearPrivateData()
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
/** Customer-facing plan names: the internal identifier `basic` sells as Standard. */
const tierLabel = (tier: string | null | undefined): string =>
  tier === 'basic' ? 'Standard' : (tier ?? '')
</script>

<template>
  <main class="mx-auto min-h-[calc(100vh-5rem)] max-w-6xl px-4 py-10 sm:px-6 md:py-16">
    <header class="border-b border-brand-border pb-8 md:flex md:items-end md:justify-between md:gap-8">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-brand-accent">
          Customer dashboard
        </p>
        <h1 class="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
          Your launches
        </h1>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-brand-muted sm:text-base">
          Keep your listing accurate, manage its billing, and see the discovery facts LaunchLog publishes.
        </p>
      </div>

      <div class="mt-6 flex items-center gap-3 md:mt-0">
        <span v-if="authReady && user?.email" class="hidden max-w-56 truncate text-sm text-brand-muted sm:block">
          {{ user.email }}
        </span>
        <Button variant="outline" :disabled="signingOut" @click="signOut">
          <AppSpinner v-if="signingOut" color="text-current" label="Signing out" />
          <LogOut v-else aria-hidden="true" />
          {{ signingOut ? 'Signing out…' : 'Sign out' }}
        </Button>
      </div>
    </header>

    <section v-if="loading" class="mt-10 rounded-xl border border-brand-border bg-white/[0.025] px-6 py-16 text-center">
      <AppSpinner class="mx-auto" size="size-6" label="Loading your launches" />
      <p class="mt-4 text-sm text-brand-muted">
        Loading your launch record…
      </p>
    </section>

    <section v-else-if="error" class="mt-10 rounded-xl border border-red-400/20 bg-red-400/[0.05] px-6 py-10" role="alert">
      <p class="font-medium text-white">
        We could not load your launches.
      </p>
      <p class="mt-2 text-sm text-red-200/80">
        {{ error }}
      </p>
      <Button class="mt-6" variant="outline" @click="loadListings">
        Try again
      </Button>
    </section>

    <section v-else-if="!listings.length" class="mt-10 rounded-xl border border-dashed border-brand-border bg-white/[0.02] px-6 py-16 text-center">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-brand-muted">
        No launches yet
      </p>
      <h2 class="mt-4 text-2xl font-semibold text-white">
        Your first listing starts with a URL.
      </h2>
      <p class="mx-auto mt-3 max-w-lg text-sm leading-6 text-brand-muted">
        Create a private preview, review how it will appear, then publish when it is ready.
      </p>
      <Button class="mt-7" size="lg" as-child>
        <NuxtLink to="/submit">
          Preview a launch
        </NuxtLink>
      </Button>
    </section>

    <div v-else class="mt-10 space-y-8">
      <article
        v-for="listing in listings"
        :key="listing.id"
        class="overflow-hidden rounded-xl border border-brand-border bg-white/[0.025]"
      >
        <div class="grid border-b border-brand-border lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div class="p-5 sm:p-7">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]" :class="statusClasses[listing.status]">
                {{ statusLabels[listing.status] }}
              </span>
              <span v-if="listing.tier" class="rounded-full border border-brand-accent/25 bg-brand-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-200">
                {{ tierLabel(listing.tier) }}
              </span>
            </div>
            <h2 class="mt-4 text-2xl font-semibold tracking-tight text-white">
              {{ listing.name }}
            </h2>
            <a :href="listing.url" target="_blank" rel="noopener noreferrer" class="mt-2 inline-flex max-w-full items-center gap-1.5 truncate text-sm text-brand-muted transition-colors hover:text-white focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
              {{ listing.url }}
              <ExternalLink class="size-3.5 shrink-0" aria-hidden="true" />
            </a>
          </div>

          <div class="border-t border-brand-border bg-black/10 p-5 sm:p-7 lg:border-l lg:border-t-0">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
              Subscription
            </p>
            <template v-if="listing.subscription">
              <p class="mt-3 text-sm font-medium text-white">
                {{ listing.subscription.status.replace('_', ' ') }} · {{ tierLabel(listing.subscription.tier) }}
              </p>
              <p class="mt-1 text-xs leading-5 text-brand-muted">
                {{ listing.subscription.canceled_at ? 'Canceled' : 'Current period ends' }}
                {{ formatDate(listing.subscription.canceled_at ?? listing.subscription.current_period_end) }}
              </p>
              <Button
                class="mt-5 w-full"
                variant="outline"
                :disabled="billingIds.has(listing.id)"
                @click="manageBilling(listing)"
              >
                <AppSpinner v-if="billingIds.has(listing.id)" color="text-current" label="Opening billing" />
                <CreditCard v-else aria-hidden="true" />
                {{ billingIds.has(listing.id) ? 'Opening…' : 'Manage billing' }}
              </Button>
            </template>
            <p v-else class="mt-3 text-sm leading-6 text-brand-muted">
              Billing becomes available when a paid subscription is attached to this listing.
            </p>
          </div>
        </div>

        <div class="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <form class="p-5 sm:p-7" @submit.prevent="save(listing)">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
                  Listing details
                </p>
                <p class="mt-1 text-xs text-brand-muted">
                  Only these three public fields can be changed here.
                </p>
              </div>
              <span v-if="savedIds.has(listing.id)" class="text-xs font-medium text-brand-success" role="status">
                Saved
              </span>
            </div>

            <div v-if="drafts[listing.id]" class="mt-6 space-y-5">
              <div class="space-y-2">
                <Label :for="`listing-${listing.id}-name`">Name</Label>
                <Input
                  :id="`listing-${listing.id}-name`"
                  v-model="drafts[listing.id]!.name"
                  minlength="2"
                  maxlength="120"
                  required
                  :disabled="savingIds.has(listing.id)"
                  class="h-11 border-brand-border bg-black/10 text-white focus-visible:border-brand-accent focus-visible:ring-brand-accent/30"
                  @input="clearSaved(listing.id)"
                />
              </div>

              <div class="space-y-2">
                <Label :for="`listing-${listing.id}-tagline`">Tagline</Label>
                <Input
                  :id="`listing-${listing.id}-tagline`"
                  v-model="drafts[listing.id]!.tagline"
                  maxlength="200"
                  :disabled="savingIds.has(listing.id)"
                  class="h-11 border-brand-border bg-black/10 text-white focus-visible:border-brand-accent focus-visible:ring-brand-accent/30"
                  @input="clearSaved(listing.id)"
                />
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between gap-4">
                  <Label :for="`listing-${listing.id}-description`">Description</Label>
                  <span class="text-xs text-brand-muted">{{ drafts[listing.id]!.description.length }}/4000</span>
                </div>
                <textarea
                  :id="`listing-${listing.id}-description`"
                  v-model="drafts[listing.id]!.description"
                  maxlength="4000"
                  rows="6"
                  :disabled="savingIds.has(listing.id)"
                  class="w-full resize-y rounded-md border border-brand-border bg-black/10 px-3 py-2.5 text-sm leading-6 text-white outline-none transition-[border-color,box-shadow] placeholder:text-brand-muted focus-visible:border-brand-accent focus-visible:ring-3 focus-visible:ring-brand-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
                  @input="clearSaved(listing.id)"
                />
              </div>
            </div>

            <p v-if="actionErrors[listing.id]" class="mt-4 text-sm text-red-300" role="alert">
              {{ actionErrors[listing.id] }}
            </p>

            <Button type="submit" class="mt-6 w-full sm:w-auto" size="lg" :disabled="savingIds.has(listing.id)">
              <AppSpinner v-if="savingIds.has(listing.id)" color="text-current" label="Saving listing" />
              <Save v-else aria-hidden="true" />
              {{ savingIds.has(listing.id) ? 'Saving…' : 'Save details' }}
            </Button>
          </form>

          <section class="border-t border-brand-border bg-black/10 p-5 sm:p-7 lg:border-l lg:border-t-0" :aria-labelledby="`receipt-${listing.id}`">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-accent">
              Launch Receipt Lite
            </p>
            <h3 :id="`receipt-${listing.id}`" class="mt-3 text-xl font-semibold text-white">
              Published facts
            </h3>
            <p class="mt-2 text-sm leading-6 text-brand-muted">
              Deterministic checks from the current LaunchLog publication state — no scores or ranking claims.
            </p>

            <ul class="mt-6 divide-y divide-brand-border border-y border-brand-border">
              <li v-for="row in receiptRows" :key="row.key" class="flex min-h-12 items-center gap-3 py-3">
                <span class="flex size-6 shrink-0 items-center justify-center rounded-full border" :class="listing.receipt.checks[row.key] ? 'border-brand-success/30 bg-brand-success/10 text-brand-success' : 'border-white/10 bg-white/[0.03] text-brand-muted'">
                  <Check v-if="listing.receipt.checks[row.key]" class="size-3.5" aria-hidden="true" />
                  <CircleDashed v-else class="size-3.5" aria-hidden="true" />
                </span>
                <span class="min-w-0 flex-1 text-sm text-white">{{ row.label }}</span>
                <a
                  v-if="listing.receipt.checks[row.key]"
                  :href="listing.receipt[row.linkKey]"
                  :aria-label="`Open ${row.label} for ${listing.name}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="rounded-sm text-xs font-medium text-brand-accent transition-colors hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                >
                  Open
                </a>
                <span v-else class="text-xs text-brand-muted">{{ receiptUnavailableLabel(listing.status) }}</span>
              </li>
            </ul>

            <Button v-if="listing.status === 'published'" class="mt-6 w-full" variant="outline" as-child>
              <a :href="listing.receipt.public_url" target="_blank" rel="noopener noreferrer">
                View public listing
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          </section>
        </div>
      </article>
    </div>
  </main>
</template>
