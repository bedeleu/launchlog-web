<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { AdminListing } from '~/composables/useAdminListings'
import { toErrorLike } from '~/utils/error-like'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Admin · Edit listing', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const route = useRoute()
const id = route.params.id as string
const { get, update, publish, unpublish, reject } = useAdminListings()

const listing = ref<AdminListing | null>(null)
const loading = ref(true)
const submitting = ref(false)
const error = ref<string | null>(null)
const saved = ref(false)

async function load() {
  loading.value = true
  try {
    listing.value = await get(id)
  }
  catch (e: unknown) {
    error.value = toErrorLike(e).data?.error ?? 'Listing not found'
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
    const err = toErrorLike(e)
    error.value = err.data?.message ?? err.data?.error ?? 'Failed to save'
  }
  finally {
    submitting.value = false
  }
}

async function act(verb: 'publish' | 'unpublish' | 'reject') {
  const fn = verb === 'publish' ? publish : verb === 'unpublish' ? unpublish : reject
  listing.value = await fn(id)
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8">
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
          :key="listing.id"
          :initial="listing"
          :submitting="submitting"
          submit-label="Save changes"
          @submit="onSubmit"
        >
          <template #actions>
            <Button v-if="listing.status !== 'published'" type="button" variant="outline" @click="act('publish')">
              Publish
            </Button>
            <Button v-if="listing.status === 'published'" type="button" variant="outline" @click="act('unpublish')">
              Move to pending
            </Button>
            <Button v-if="listing.status !== 'rejected'" type="button" variant="ghost" class="text-red-400 hover:text-red-300" @click="act('reject')">
              Reject
            </Button>
          </template>
        </AdminListingForm>
      </div>
    </template>
  </div>
</template>
