<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { AdminListing, AdminListingFilters, ListingStatus } from '~/composables/useAdminListings'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Admin · Listings', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const { list, publish, unpublish, reject } = useAdminListings()

const filters = reactive<AdminListingFilters>({ status: '', tier: '', source: '', q: '' })
const listings = ref<AdminListing[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const statusClass: Record<ListingStatus, string> = {
  published: 'border-brand-accent/40 bg-brand-accent/10 text-brand-accent',
  pending_review: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  rejected: 'border-red-500/40 bg-red-500/10 text-red-400',
  draft: 'border-brand-border bg-white/[0.04] text-brand-muted',
  archived: 'border-brand-border bg-white/[0.04] text-brand-muted',
  spam: 'border-red-500/40 bg-red-500/10 text-red-400',
}

async function load() {
  loading.value = true
  error.value = null
  try {
    listings.value = await list(filters)
  }
  catch (e: any) {
    error.value = e?.data?.error ?? e?.message ?? 'Failed to load listings'
  }
  finally {
    loading.value = false
  }
}

async function act(l: AdminListing, verb: 'publish' | 'unpublish' | 'reject') {
  const fn = verb === 'publish' ? publish : verb === 'unpublish' ? unpublish : reject
  const updated = await fn(l.id)
  const i = listings.value.findIndex(x => x.id === l.id)
  if (i !== -1) listings.value[i] = updated
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8">
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-brand-fg">
        Listings
      </h1>
      <Button as-child>
        <NuxtLink to="/admin/listings/new">
          New listing
        </NuxtLink>
      </Button>
    </div>

    <!-- Filters -->
    <div class="mt-6 flex flex-wrap items-end gap-3">
      <label class="flex flex-col gap-1 text-xs text-brand-muted">
        Status
        <select v-model="filters.status" class="rounded-md border border-brand-border bg-transparent px-2 py-1.5 text-sm text-brand-fg" @change="load">
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
        <select v-model="filters.tier" class="rounded-md border border-brand-border bg-transparent px-2 py-1.5 text-sm text-brand-fg" @change="load">
          <option value="">All</option>
          <option value="basic">Basic</option>
          <option value="premium">Premium</option>
          <option value="featured">Featured</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-brand-muted">
        Source
        <select v-model="filters.source" class="rounded-md border border-brand-border bg-transparent px-2 py-1.5 text-sm text-brand-fg" @change="load">
          <option value="">All</option>
          <option value="founding">Founding</option>
          <option value="customer">Customer</option>
          <option value="admin">Admin</option>
          <option value="seed">Seed</option>
        </select>
      </label>
      <label class="flex flex-1 flex-col gap-1 text-xs text-brand-muted">
        Search
        <input v-model="filters.q" type="search" placeholder="name, url, tagline" class="rounded-md border border-brand-border bg-transparent px-2 py-1.5 text-sm text-brand-fg" @keyup.enter="load">
      </label>
      <Button variant="outline" :disabled="loading" @click="load">
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
              <div class="flex items-center justify-end gap-1.5">
                <Button size="sm" variant="ghost" as-child>
                  <NuxtLink :to="`/admin/listings/${l.id}`">Edit</NuxtLink>
                </Button>
                <Button v-if="l.status !== 'published'" size="sm" variant="outline" @click="act(l, 'publish')">
                  Publish
                </Button>
                <Button v-if="l.status === 'published'" size="sm" variant="outline" @click="act(l, 'unpublish')">
                  Pending
                </Button>
                <Button v-if="l.status !== 'rejected'" size="sm" variant="ghost" class="text-red-400 hover:text-red-300" @click="act(l, 'reject')">
                  Reject
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
