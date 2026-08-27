<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { AdminCategory, AdminListing } from '~/composables/useAdminListings'
import { toErrorLike } from '~/utils/error-like'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Admin · Edit listing', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const route = useRoute()
const id = route.params.id as string
const { get, categories, update, publish, unpublish, reject } = useAdminListings()

const listing = ref<AdminListing | null>(null)
const categoryOptions = ref<AdminCategory[]>([])
const loading = ref(true)
const submitting = ref(false)
const actionBusy = ref<'publish' | 'unpublish' | 'reject' | null>(null)
const error = ref<string | null>(null)
const saved = ref(false)

function errorMessage(e: unknown, fallback: string): string {
  const err = toErrorLike(e)
  return err.data?.message ?? err.data?.error ?? err.message ?? fallback
}

async function load() {
  loading.value = true
  try {
    const [loadedListing, loadedCategories] = await Promise.all([get(id), categories()])
    listing.value = loadedListing
    categoryOptions.value = loadedCategories
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
  saved.value = false
  try {
    listing.value = await update(id, payload)
    saved.value = true
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
  saved.value = false
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
      </div>

      <p v-if="error" class="mt-4 text-sm text-red-400">
        {{ error }}
      </p>
      <p v-if="saved" class="mt-4 text-sm text-brand-accent">
        Saved.
      </p>

      <div class="mt-6">
        <AdminListingForm
          :key="`${listing.id}:${listing.status}:${listing.updated_at ?? ''}`"
          :initial="listing"
          :categories="categoryOptions"
          :submitting="submitting || !!actionBusy"
          submit-label="Save changes"
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
