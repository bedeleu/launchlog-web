<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { AdminListing, AdminListingFilters, FounderScreenshotStatus, ListingStatus } from '~/composables/useAdminListings'
import { toErrorLike } from '~/utils/error-like'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Admin · Listings', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const { list, publish, unpublish, reject, runFounderScreenshots, founderScreenshotStatus } = useAdminListings()

const filters = reactive<AdminListingFilters>({ status: '', tier: '', source: '', q: '' })
const listings = ref<AdminListing[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const screenshotStatus = ref<FounderScreenshotStatus | null>(null)
const screenshotBusy = ref(false)
const screenshotMessage = ref<string | null>(null)

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
  catch (e: unknown) {
    const err = toErrorLike(e)
    error.value = err.data?.error ?? err.message ?? 'Failed to load listings'
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

onMounted(async () => {
  await load()
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
