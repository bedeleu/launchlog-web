<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { AdminCategory, AdminListing } from '~/composables/useAdminListings'
import type { AiEnrichmentField, AiEnrichmentProposal } from '~/composables/useAiEnrichment'
import { toErrorLike } from '~/utils/error-like'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Admin · Edit listing', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const route = useRoute()
const id = route.params.id as string
const { get, categories, update, publish, unpublish, reject } = useAdminListings()
const { listAdminProposals, generateAdminProposal, applyAdminProposal, rejectAdminProposal, approveAdminCategory } = useAiEnrichment()

const listing = ref<AdminListing | null>(null)
const categoryOptions = ref<AdminCategory[]>([])
const loading = ref(true)
const submitting = ref(false)
const actionBusy = ref<'publish' | 'unpublish' | 'reject' | null>(null)
const error = ref<string | null>(null)
const announcement = ref('')
const aiProposal = ref<AiEnrichmentProposal | null>(null)
const aiBusy = ref(false)

function errorMessage(e: unknown, fallback: string): string {
  const err = toErrorLike(e)
  return err.data?.message ?? err.data?.error ?? err.message ?? fallback
}

async function load() {
  loading.value = true
  try {
    const [loadedListing, loadedCategories, proposals] = await Promise.all([
      get(id),
      categories(),
      listAdminProposals(id),
    ])
    listing.value = loadedListing
    categoryOptions.value = loadedCategories
    aiProposal.value = proposals.find(proposal => proposal.status === 'pending') ?? null
  }
  catch (e: unknown) {
    error.value = errorMessage(e, 'Listing not found')
  }
  finally {
    loading.value = false
  }
}

async function onSubmit(payload: Record<string, unknown>) {
  submitting.value = true
  error.value = null
  try {
    listing.value = await update(id, payload)
    announcement.value = 'Manual edits saved.'
  }
  catch (e: unknown) {
    error.value = errorMessage(e, 'Failed to save')
  }
  finally {
    submitting.value = false
  }
}

async function act(verb: 'publish' | 'unpublish' | 'reject') {
  actionBusy.value = verb
  error.value = null
  const fn = verb === 'publish' ? publish : verb === 'unpublish' ? unpublish : reject
  try {
    listing.value = await fn(id)
  }
  catch (e: unknown) {
    error.value = errorMessage(e, `Failed to ${verb} listing`)
  }
  finally {
    actionBusy.value = null
  }
}

async function generateAiDraft() {
  if (aiBusy.value) return
  aiBusy.value = true
  error.value = null
  try {
    aiProposal.value = await generateAdminProposal(id)
  }
  catch (e: unknown) {
    error.value = errorMessage(e, 'The grounded AI draft could not be prepared.')
  }
  finally {
    aiBusy.value = false
  }
}

async function applyAiDraft(fields: AiEnrichmentField[]) {
  if (!aiProposal.value || aiBusy.value) return
  aiBusy.value = true
  error.value = null
  try {
    await applyAdminProposal(aiProposal.value.id, fields)
    aiProposal.value = null
    await load()
    announcement.value = 'AI changes applied. The public listing is updated.'
  }
  catch (e: unknown) {
    error.value = errorMessage(e, 'The selected suggestions could not be applied.')
  }
  finally {
    aiBusy.value = false
  }
}

async function dismissAiDraft() {
  if (!aiProposal.value || aiBusy.value) return
  aiBusy.value = true
  try {
    await rejectAdminProposal(aiProposal.value.id)
    aiProposal.value = null
  }
  catch (e: unknown) {
    error.value = errorMessage(e, 'The draft could not be dismissed.')
  }
  finally {
    aiBusy.value = false
  }
}

async function approveAiCategory() {
  if (!aiProposal.value || aiBusy.value) return
  aiBusy.value = true
  try {
    aiProposal.value = await approveAdminCategory(aiProposal.value.id)
    categoryOptions.value = await categories()
  }
  catch (e: unknown) {
    error.value = errorMessage(e, 'The category could not be approved.')
  }
  finally {
    aiBusy.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="min-h-screen bg-release-ink">
    <ReleaseShell
      eyebrow="Operator desk · release record"
      :title="listing?.name ?? 'Listing record'"
      description="Review grounded copy, directory placement, publication state, and the captured source in one operator record."
      wide-rail
    >
      <NuxtLink to="/admin/listings" class="inline-flex font-mono text-xs font-semibold uppercase tracking-[0.1em] text-release-paper-muted underline decoration-release-seam underline-offset-4 hover:text-release-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-warning">
        ← Back to listings
      </NuxtLink>

      <div v-if="loading" class="mt-10 min-h-48 border border-release-seam bg-release-rail p-8">
        <AppSpinner size="size-6" label="Loading listing" />
        <p class="mt-4 font-mono text-xs uppercase tracking-[0.12em] text-release-paper-muted">Loading release record</p>
      </div>

      <ReleaseStateMarker v-else-if="!listing" class="mt-6" label="Listing unavailable" :detail="error ?? 'Listing not found.'" state="destructive" live />

      <template v-else>
        <div class="mt-5 flex flex-wrap items-center justify-end gap-2 border-y border-release-seam bg-release-rail px-4 py-3">
          <a
            v-if="listing.status === 'published'"
            :href="`/listing/${listing.slug}`"
            target="_blank"
            class="inline-flex min-h-9 items-center border border-release-seam bg-release-ink px-3 font-mono text-xs text-release-paper transition-colors hover:border-release-warning hover:text-release-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-warning"
          >
            View public page ↗
          </a>
          <Button v-if="!aiProposal" type="button" variant="outline" size="sm" class="rounded-none border-release-seam bg-release-ink font-mono text-xs text-release-paper hover:border-release-warning hover:bg-release-rail hover:text-release-warning" :disabled="aiBusy" @click="generateAiDraft">
            <AppSpinner v-if="aiBusy && !aiProposal" color="text-current" label="Preparing grounded draft" />
            {{ aiBusy && !aiProposal ? 'Preparing…' : 'Generate AI draft' }}
          </Button>
        </div>

        <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>

        <ReleaseStateMarker v-if="error" class="mt-4" label="Action failed" :detail="error" state="destructive" live />

        <AiProposalReview
          v-if="aiProposal"
          class="mt-6"
          :current="aiProposal.current"
          :proposed="aiProposal.proposed"
          :evidence="aiProposal.evidence"
          :category-requires-approval="aiProposal.category.requires_approval"
          mode="admin"
          :busy="aiBusy"
          @apply="applyAiDraft"
          @reject="dismissAiDraft"
          @approve-category="approveAiCategory"
        />

        <div v-if="!aiProposal" class="mt-6 border border-release-seam bg-release-rail p-4 sm:p-6">
          <AdminListingForm
            :key="`${listing.id}:${listing.status}:${listing.updated_at ?? ''}`"
            :initial="listing"
            :categories="categoryOptions"
            :submitting="submitting || !!actionBusy"
            submit-label="Save manual edits"
            @submit="onSubmit"
          >
            <template #actions>
              <Button v-if="listing.status !== 'published'" type="button" variant="outline" class="rounded-none border-release-seam bg-release-ink font-mono text-xs text-release-paper hover:border-release-warning hover:bg-release-rail hover:text-release-warning" :disabled="submitting || !!actionBusy" @click="act('publish')">
                <AppSpinner v-if="actionBusy === 'publish'" class="mr-1.5" size="sm" color="text-current" label="Publishing listing" />
                {{ actionBusy === 'publish' ? 'Publishing…' : 'Publish' }}
              </Button>
              <Button v-if="listing.status === 'published'" type="button" variant="outline" class="rounded-none border-release-seam bg-release-ink font-mono text-xs text-release-paper hover:border-release-warning hover:bg-release-rail hover:text-release-warning" :disabled="submitting || !!actionBusy" @click="act('unpublish')">
                <AppSpinner v-if="actionBusy === 'unpublish'" class="mr-1.5" size="sm" color="text-current" label="Unpublishing listing" />
                {{ actionBusy === 'unpublish' ? 'Unpublishing…' : 'Unpublish to pending review' }}
              </Button>
              <Button v-if="listing.status !== 'rejected'" type="button" variant="ghost" class="rounded-none font-mono text-xs text-release-destructive hover:bg-release-ink hover:text-release-destructive" :disabled="submitting || !!actionBusy" @click="act('reject')">
                <AppSpinner v-if="actionBusy === 'reject'" class="mr-1.5" size="sm" color="text-current" label="Rejecting listing" />
                {{ actionBusy === 'reject' ? 'Rejecting…' : 'Reject' }}
              </Button>
            </template>
          </AdminListingForm>
        </div>
      </template>
    </ReleaseShell>
  </div>
</template>
