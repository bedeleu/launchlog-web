<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
useHead({ title: 'Admin · New listing', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const { create } = useAdminListings()
const submitting = ref(false)
const error = ref<string | null>(null)

async function onSubmit(payload: Record<string, unknown>) {
  submitting.value = true
  error.value = null
  try {
    const created = await create(payload)
    await navigateTo(`/admin/listings/${created.id}`)
  }
  catch (e: any) {
    error.value = e?.data?.message ?? e?.data?.error ?? 'Failed to create listing'
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8">
    <NuxtLink to="/admin/listings" class="text-sm text-brand-muted hover:text-brand-accent">
      ← Back to listings
    </NuxtLink>
    <h1 class="mt-3 text-2xl font-bold text-brand-fg">
      New listing
    </h1>

    <p v-if="error" class="mt-4 text-sm text-red-400">
      {{ error }}
    </p>

    <div class="mt-6">
      <AdminListingForm :submitting="submitting" submit-label="Create listing" @submit="onSubmit" />
    </div>
  </div>
</template>
