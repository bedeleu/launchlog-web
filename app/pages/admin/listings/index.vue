<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { AdminListing, AdminListingFilters, AdminListingPaginationMeta, FounderScreenshotStatus, ListingStatus } from '~/composables/useAdminListings'
import { toErrorLike } from '~/utils/error-like'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Admin · Listings', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const { list, publish, unpublish, reject, runFounderScreenshots, founderScreenshotStatus } = useAdminListings()
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
let loadRequestId = 0

const statusClass: Record<ListingStatus, string> = {
  published: 'border-release-blaze/40 bg-release-blaze/10 text-release-blaze',
  pending_review: 'border-release-warning/40 bg-release-warning/10 text-release-warning',
  rejected: 'border-release-destructive/40 bg-release-destructive/10 text-release-destructive',
  draft: 'border-release-seam bg-release-rail text-release-paper-muted',
  archived: 'border-release-seam bg-release-rail text-release-paper-muted',
  spam: 'border-release-destructive/40 bg-release-destructive/10 text-release-destructive',
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
      <h1 class="text-2xl font-bold text-release-paper">
        Listings
      </h1>
      <Button as-child>
        <NuxtLink to="/submit">
          Add by URL
        </NuxtLink>
      </Button>
    </div>

    <section class="mt-6 border border-release-seam bg-release-rail p-4">
      <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div class="text-xs font-semibold uppercase tracking-[0.24em] text-release-paper-muted">
            Founding screenshots
          </div>
          <p class="mt-1 max-w-2xl text-sm text-release-paper-muted">
            Runs inside Railway, writes thumbnails to Cloudflare R2, and only picks listings without a public screenshot.
          </p>
          <p v-if="screenshotMessage" class="mt-2 text-sm text-release-blaze">
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
      <div v-if="screenshotStatus?.log_file" class="mt-4 border border-release-seam bg-release-ink p-3">
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-release-paper-muted">
          <span>{{ screenshotStatus.log_file }}</span>
          <span>{{ screenshotStatus.modified_at }}</span>
        </div>
        <pre class="mt-3 max-h-52 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-release-paper-muted">{{ screenshotStatus.tail.join('\n') }}</pre>
      </div>
    </section>

    <!-- Filters -->
    <div class="mt-6 flex flex-wrap items-end gap-3">
      <label class="flex flex-col gap-1 text-xs text-release-paper-muted">
        Status
        <span class="relative">
          <select v-model="filters.status" class="release-field h-10 min-w-36 appearance-none px-3 pr-9 text-sm" @change="load(1)">
            <option value="">All</option>
            <option value="published">Published</option>
            <option value="pending_review">Pending review</option>
            <option value="draft">Draft</option>
            <option value="rejected">Rejected</option>
            <option value="archived">Archived</option>
          </select>
          <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" />
        </span>
      </label>
      <label class="flex flex-col gap-1 text-xs text-release-paper-muted">
        Tier
        <span class="relative">
          <select v-model="filters.tier" class="release-field h-10 min-w-32 appearance-none px-3 pr-9 text-sm" @change="load(1)">
            <option value="">All</option>
            <option value="basic">Standard</option>
            <option value="featured">Featured</option>
          </select>
          <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" />
        </span>
      </label>
      <label class="flex flex-col gap-1 text-xs text-release-paper-muted">
        Source
        <span class="relative">
          <select v-model="filters.source" class="release-field h-10 min-w-32 appearance-none px-3 pr-9 text-sm" @change="load(1)">
            <option value="">All</option>
            <option value="founding">Founding</option>
            <option value="customer">Customer</option>
            <option value="admin">Admin</option>
            <option value="seed">Seed</option>
          </select>
          <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" />
        </span>
      </label>
      <label class="flex flex-1 flex-col gap-1 text-xs text-release-paper-muted">
        Search
        <input v-model="filters.q" type="search" placeholder="name, url, tagline" class="release-field h-10 min-w-52 px-3 text-sm" @keyup.enter="load(1)">
      </label>
      <Button variant="outline" :disabled="loading" @click="load(1)">
        Apply
      </Button>
    </div>

    <p v-if="error" class="mt-4 text-sm text-release-destructive">
      {{ error }}
    </p>

    <!-- Table -->
    <div class="mt-6 overflow-x-auto border border-release-seam">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-release-seam text-xs uppercase tracking-wider text-release-paper-muted">
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
            <td colspan="5" class="px-4 py-8 text-center text-release-paper-muted">
              <AppSpinner class="mx-auto" label="Loading listings" />
            </td>
          </tr>
          <tr v-else-if="!listings.length">
            <td colspan="5" class="px-4 py-8 text-center text-release-paper-muted">
              No listings match.
            </td>
          </tr>
          <tr v-for="l in listings" v-else :key="l.id" class="border-b border-release-seam/60 last:border-0">
            <td class="px-4 py-3">
              <NuxtLink :to="`/admin/listings/${l.id}`" class="font-medium text-release-paper hover:text-release-blaze">
                {{ l.name }}
              </NuxtLink>
              <div class="truncate text-xs text-release-paper-muted">{{ l.url }}</div>
            </td>
            <td class="px-4 py-3">
              <span class="inline-flex border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" :class="statusClass[l.status]">
                {{ l.status.replace('_', ' ') }}
              </span>
            </td>
            <td class="px-4 py-3 text-release-paper-muted">{{ l.tier ?? '—' }}</td>
            <td class="px-4 py-3 text-release-paper-muted">{{ l.source }}</td>
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
                <Button v-if="l.status !== 'rejected'" size="sm" variant="ghost" class="text-release-destructive hover:text-release-destructive" :disabled="!!actionBusy[l.id]" @click="act(l, 'reject')">
                  <AppSpinner v-if="actionBusy[l.id] === 'reject'" class="mr-1.5" size="sm" color="text-current" label="Rejecting listing" />
                  {{ actionBusy[l.id] === 'reject' ? 'Rejecting…' : 'Reject' }}
                </Button>
              </div>
              <p v-if="actionErrors[l.id]" class="mt-2 text-right text-xs text-release-destructive" role="alert">
                {{ actionErrors[l.id] }}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pagination" class="mt-4 flex flex-col gap-3 text-sm text-release-paper-muted sm:flex-row sm:items-center sm:justify-between">
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
