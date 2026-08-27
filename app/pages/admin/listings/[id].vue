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
const savedMessage = ref<string | null>(null)
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
  savedMessage.value = null
  try {
    listing.value = await update(id, payload)
    savedMessage.value = 'Manual edits saved.'
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
  savedMessage.value = null
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
    savedMessage.value = 'AI changes applied. The public listing is updated.'
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
  <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
    <NuxtLink to="/admin/listings" class="text-sm text-brand-muted hover:text-brand-accent">
      ← Back to listings
    </NuxtLink>

    <div v-if="loading" class="mt-10 flex justify-center">
      <AppSpinner size="size-6" label="Loading listing" />
    </div>

    <p v-else-if="!listing" class="mt-6 text-sm text-red-400">
      {{ error ?? 'Listing not found.' }}
    </p>

    <template v-else>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-bold text-brand-fg">
          {{ listing.name }}
        </h1>
        <a
          v-if="listing.status === 'published'"
          :href="`/listing/${listing.slug}`"
          target="_blank"
          class="text-sm text-brand-accent hover:underline"
        >
          View public page ↗
        </a>
        <Button v-if="!aiProposal" type="button" variant="outline" :disabled="aiBusy" @click="generateAiDraft">
          <AppSpinner v-if="aiBusy && !aiProposal" color="text-current" label="Preparing grounded draft" />
          {{ aiBusy && !aiProposal ? 'Preparing…' : 'Generate AI draft' }}
        </Button>
      </div>

      <p v-if="error" class="mt-4 text-sm text-red-400">
        {{ error }}
      </p>
      <p v-if="savedMessage" class="mt-4 text-sm text-brand-success" role="status">
        {{ savedMessage }}
      </p>

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

      <div class="mt-6">
        <AdminListingForm
          :key="`${listing.id}:${listing.status}:${listing.updated_at ?? ''}`"
          :initial="listing"
          :categories="categoryOptions"
          :submitting="submitting || !!actionBusy"
          submit-label="Save manual edits"
          @submit="onSubmit"
        >
          <template #actions>
            <Button v-if="listing.status !== 'published'" type="button" variant="outline" :disabled="submitting || !!actionBusy" @click="act('publish')">
              <AppSpinner v-if="actionBusy === 'publish'" class="mr-1.5" size="sm" color="text-current" label="Publishing listing" />
              {{ actionBusy === 'publish' ? 'Publishing…' : 'Publish' }}
            </Button>
            <Button v-if="listing.status === 'published'" type="button" variant="outline" :disabled="submitting || !!actionBusy" @click="act('unpublish')">
              <AppSpinner v-if="actionBusy === 'unpublish'" class="mr-1.5" size="sm" color="text-current" label="Unpublishing listing" />
              {{ actionBusy === 'unpublish' ? 'Unpublishing…' : 'Unpublish to pending review' }}
            </Button>
            <Button v-if="listing.status !== 'rejected'" type="button" variant="ghost" class="text-red-400 hover:text-red-300" :disabled="submitting || !!actionBusy" @click="act('reject')">
              <AppSpinner v-if="actionBusy === 'reject'" class="mr-1.5" size="sm" color="text-current" label="Rejecting listing" />
              {{ actionBusy === 'reject' ? 'Rejecting…' : 'Reject' }}
            </Button>
          </template>
        </AdminListingForm>
      </div>
    </template>
  </div>
</template>
