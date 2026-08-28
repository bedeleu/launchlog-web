<script setup lang="ts">
import { ArrowRight, Camera, CheckCircle2, Clock3, Gauge, ListChecks, ScanLine, Send, ShieldCheck, Sparkles } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { AdminDashboard, AdminListing, FounderScreenshotStatus } from '~/composables/useAdminListings'
import { toErrorLike } from '~/utils/error-like'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Admin · LaunchLog' })

const { dashboard, runFounderScreenshots, founderScreenshotStatus } = useAdminListings()

const data = ref<AdminDashboard | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const screenshotStatus = ref<FounderScreenshotStatus | null>(null)
const screenshotBusy = ref(false)
const screenshotMessage = ref<string | null>(null)

async function loadDashboard() {
  loading.value = true
  error.value = null

  try {
    data.value = await dashboard()
  }
  catch (e: unknown) {
    const err = toErrorLike(e)
    error.value = err.data?.message ?? err.data?.error ?? err.message ?? 'Could not load admin dashboard'
  }
  finally {
    loading.value = false
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
    screenshotMessage.value = `${dryRun ? 'Dry run' : 'Screenshot batch'} started in Railway. PID ${run.pid}.`
    await refreshScreenshotStatus()
    await loadDashboard()
  }
  catch (e: unknown) {
    const err = toErrorLike(e)
    error.value = err.data?.message ?? err.data?.error ?? err.message ?? 'Could not start screenshot batch'
  }
  finally {
    screenshotBusy.value = false
  }
}

const numberFormat = new Intl.NumberFormat('en-US')

const kpis = computed(() => {
  const totals = data.value?.totals

  return [
    {
      label: 'Published listings',
      value: totals?.published ?? 0,
      detail: `${data.value?.coverage.published_percent ?? 0}% of directory`,
      icon: CheckCircle2,
      accent: 'text-release-signal',
    },
    {
      label: 'Pending review',
      value: totals?.pending_review ?? 0,
      detail: 'Needs moderation',
      icon: Clock3,
      accent: 'text-release-warning',
    },
    {
      label: 'R2 screenshots ready',
      value: totals?.with_screenshots ?? 0,
      detail: `${data.value?.coverage.screenshot_percent ?? 0}% CDN coverage`,
      icon: Camera,
      accent: 'text-release-paper',
    },
    {
      label: 'Total records',
      value: totals?.listings ?? 0,
      detail: 'All statuses',
      icon: Gauge,
      accent: 'text-release-paper-muted',
    },
  ]
})

const tierRows = computed<Array<[string, number]>>(() => {
  const counts = data.value?.tier_counts ?? {}
  return [
    ['Standard', counts.basic ?? 0],
    ['Featured', counts.featured ?? 0],
  ]
})

const statusRows = computed<Array<[string, number]>>(() => {
  const counts = data.value?.status_counts ?? {}
  return [
    ['Published', counts.published ?? 0],
    ['Pending review', counts.pending_review ?? 0],
    ['Draft', counts.draft ?? 0],
    ['Rejected', counts.rejected ?? 0],
  ]
})

const sourceRows = computed<Array<[string, number]>>(() => {
  const counts = data.value?.source_counts ?? {}
  return [
    ['Founding', counts.founding ?? 0],
    ['Customer', counts.customer ?? 0],
    ['Admin', counts.admin ?? 0],
    ['Seed', counts.seed ?? 0],
  ]
})

const lastBatchSummary = computed(() => {
  const doneLine = [...(screenshotStatus.value?.tail ?? [])]
    .reverse()
    .find(line => line.includes('Done. captured='))

  if (!doneLine) return null

  const match = doneLine.match(/captured=(\d+)\s+reused=(\d+)\s+skipped=(\d+)\s+failed=(\d+)/)
  if (!match) return null

  return {
    captured: Number(match[1]),
    reused: Number(match[2]),
    skipped: Number(match[3]),
    failed: Number(match[4]),
  }
})

const screenshotLimitNotice = computed(() => {
  const line = [...(screenshotStatus.value?.tail ?? [])]
    .reverse()
    .find(line => line.includes('Microlink daily limit reached'))

  if (!line) return null

  const retryMatch = line.match(/Try again in ~([^.]+)\./)

  return retryMatch
    ? `Microlink daily limit reached. Try again in about ${retryMatch[1]}.`
    : 'Microlink daily limit reached. Try again tomorrow.'
})

function listingStatusClass(listing: AdminListing) {
  if (listing.status === 'published') return 'border-release-signal/30 bg-release-signal/10 text-release-signal'
  if (listing.status === 'pending_review') return 'border-release-warning/30 bg-release-warning/10 text-release-warning'
  if (listing.status === 'rejected') return 'border-release-destructive/30 bg-release-destructive/10 text-release-destructive'
  return 'border-release-seam bg-release-rail text-release-paper-muted'
}

onMounted(async () => {
  await loadDashboard()
  try {
    await refreshScreenshotStatus()
  }
  catch {
    screenshotStatus.value = null
  }
})
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-release-warning">
          LaunchLog operations
        </p>
        <h1 class="mt-3 text-3xl font-semibold tracking-tight text-release-paper sm:text-4xl">
          Admin dashboard
        </h1>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-release-paper-muted">
          Manage listings, moderation, founding screenshots, and public directory quality from one place.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button as-child variant="outline">
          <NuxtLink to="/admin/outreach">
            <Send class="mr-2 size-4" />
            Outreach send
          </NuxtLink>
        </Button>
        <Button as-child variant="outline">
          <NuxtLink to="/admin/listings">
            <ListChecks class="mr-2 size-4" />
            Listings
          </NuxtLink>
        </Button>
        <Button as-child>
          <NuxtLink to="/submit">
            <ScanLine class="mr-2 size-4" />
            Scan website
          </NuxtLink>
        </Button>
      </div>
    </div>

    <div v-if="loading" class="mt-16 flex items-center justify-center border border-release-seam bg-release-rail py-20">
      <AppSpinner label="Loading admin dashboard" />
    </div>

    <p v-else-if="error" class="mt-8 border border-release-destructive/25 bg-release-destructive/10 px-4 py-3 text-sm text-release-destructive">
      {{ error }}
    </p>

    <template v-else-if="data">
      <section class="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="kpi in kpis"
          :key="kpi.label"
          class="border border-release-seam bg-release-rail p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-medium uppercase tracking-[0.18em] text-release-paper-muted">
                {{ kpi.label }}
              </p>
              <p class="mt-3 text-3xl font-semibold text-release-paper">
                {{ numberFormat.format(kpi.value) }}
              </p>
            </div>
            <component :is="kpi.icon" class="size-5" :class="kpi.accent" />
          </div>
          <p class="mt-3 text-sm text-release-paper-muted">
            {{ kpi.detail }}
          </p>
        </article>
      </section>

      <section class="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <article class="border border-release-seam bg-release-rail p-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-release-paper-muted">
                Directory health
              </p>
              <h2 class="mt-2 text-xl font-semibold text-release-paper">
                Screenshot and moderation pipeline
              </h2>
            </div>
            <ShieldCheck class="size-5 text-release-paper-muted" />
          </div>

          <div class="mt-6 grid gap-3 sm:grid-cols-3">
            <div class="border border-release-seam bg-release-ink p-3">
              <p class="text-xs text-release-paper-muted">Missing R2 screenshots</p>
              <p class="mt-2 text-2xl font-semibold text-release-paper">
                {{ numberFormat.format(data.totals.missing_screenshots) }}
              </p>
            </div>
            <div class="border border-release-seam bg-release-ink p-3">
              <p class="text-xs text-release-paper-muted">Founding backlog</p>
              <p class="mt-2 text-2xl font-semibold text-release-paper">
                {{ numberFormat.format(data.totals.founding_missing_screenshots) }}
              </p>
            </div>
            <div class="border border-release-seam bg-release-ink p-3">
              <p class="text-xs text-release-paper-muted">CDN screenshot coverage</p>
              <p class="mt-2 text-2xl font-semibold text-release-paper">
                {{ data.coverage.screenshot_percent }}%
              </p>
            </div>
          </div>

          <div class="mt-5 flex flex-wrap gap-2">
            <Button :disabled="screenshotBusy || data.totals.founding_missing_screenshots === 0" @click="startScreenshotBatch(false)">
              <AppSpinner v-if="screenshotBusy" class="mr-2" color="text-current" label="Starting screenshot batch" />
              Run 50 screenshots
              <ArrowRight v-if="!screenshotBusy" class="ml-2 size-4" />
            </Button>
            <Button variant="outline" :disabled="screenshotBusy" @click="startScreenshotBatch(true)">
              Dry run
            </Button>
            <Button as-child variant="outline">
              <NuxtLink to="/browse-all" target="_blank">
                View public directory
              </NuxtLink>
            </Button>
          </div>

          <div v-if="lastBatchSummary" class="mt-5 grid gap-2 sm:grid-cols-4">
            <div class="border border-release-signal/20 bg-release-signal/10 p-2">
              <p class="text-[11px] uppercase tracking-[0.16em] text-release-signal">Captured</p>
              <p class="mt-1 text-lg font-semibold text-release-paper">{{ lastBatchSummary.captured }}</p>
            </div>
            <div class="border border-release-paper-muted/20 bg-release-paper/10 p-2">
              <p class="text-[11px] uppercase tracking-[0.16em] text-release-paper">Reused</p>
              <p class="mt-1 text-lg font-semibold text-release-paper">{{ lastBatchSummary.reused }}</p>
            </div>
            <div class="border border-release-seam bg-release-ink p-2">
              <p class="text-[11px] uppercase tracking-[0.16em] text-release-paper-muted">Skipped</p>
              <p class="mt-1 text-lg font-semibold text-release-paper">{{ lastBatchSummary.skipped }}</p>
            </div>
            <div class="border p-2" :class="lastBatchSummary.failed > 0 ? 'border-release-warning/30 bg-release-warning/10' : 'border-release-seam bg-release-ink'">
              <p class="text-[11px] uppercase tracking-[0.16em]" :class="lastBatchSummary.failed > 0 ? 'text-release-warning' : 'text-release-paper-muted'">Failed</p>
              <p class="mt-1 text-lg font-semibold text-release-paper">{{ lastBatchSummary.failed }}</p>
            </div>
          </div>
          <p v-if="lastBatchSummary" class="mt-2 text-xs leading-5 text-release-paper-muted">
            Captured = new screenshot written now. Reused = an existing R2 snapshot was attached to the listing. Failed does not count as ready.
          </p>
          <p v-if="screenshotLimitNotice" class="mt-3 border border-release-warning/25 bg-release-warning/10 px-3 py-2 text-sm text-release-warning">
            {{ screenshotLimitNotice }}
          </p>

          <div v-if="screenshotMessage || screenshotStatus?.log_file" class="mt-5 border border-release-seam bg-release-ink p-3">
            <p v-if="screenshotMessage" class="text-sm text-release-paper">
              {{ screenshotMessage }}
            </p>
            <div v-if="screenshotStatus?.log_file" class="mt-3">
              <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-release-paper-muted">
                <span>{{ screenshotStatus.log_file }}</span>
                <button type="button" class="text-release-blaze hover:text-release-paper" @click="refreshScreenshotStatus">
                  Refresh log
                </button>
              </div>
              <pre class="mt-3 max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-release-paper-muted">{{ screenshotStatus.tail.join('\n') }}</pre>
            </div>
          </div>
        </article>

        <article class="border border-release-seam bg-release-rail p-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-release-paper-muted">
                Package mix
              </p>
              <h2 class="mt-2 text-xl font-semibold text-release-paper">
                Billing tiers
              </h2>
            </div>
            <Sparkles class="size-5 text-release-paper" />
          </div>

          <div class="mt-5 space-y-3">
            <div v-for="[label, count] in tierRows" :key="label" class="flex items-center justify-between border-b border-release-seam pb-3 last:border-0 last:pb-0">
              <span class="text-sm text-release-paper-muted">{{ label }}</span>
              <span class="font-medium text-release-paper">{{ numberFormat.format(count) }}</span>
            </div>
          </div>
        </article>
      </section>

      <section class="mt-6 grid gap-4 lg:grid-cols-3">
        <article class="border border-release-seam bg-release-rail p-5">
          <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-release-paper-muted">
            Status
          </h2>
          <div class="mt-4 space-y-3">
            <div v-for="[label, count] in statusRows" :key="label" class="flex items-center justify-between">
              <span class="text-sm text-release-paper-muted">{{ label }}</span>
              <span class="font-medium text-release-paper">{{ numberFormat.format(count) }}</span>
            </div>
          </div>
        </article>

        <article class="border border-release-seam bg-release-rail p-5">
          <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-release-paper-muted">
            Source
          </h2>
          <div class="mt-4 space-y-3">
            <div v-for="[label, count] in sourceRows" :key="label" class="flex items-center justify-between">
              <span class="text-sm text-release-paper-muted">{{ label }}</span>
              <span class="font-medium text-release-paper">{{ numberFormat.format(count) }}</span>
            </div>
          </div>
        </article>

        <article class="border border-release-seam bg-release-rail p-5">
          <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-release-paper-muted">
            Fast actions
          </h2>
          <div class="mt-4 grid gap-2">
            <NuxtLink to="/admin/listings?status=pending_review" class="border border-release-seam px-3 py-2 text-sm text-release-paper transition-colors hover:border-release-blaze hover:text-release-blaze">
              Review pending listings
            </NuxtLink>
            <NuxtLink to="/admin/listings?source=founding" class="border border-release-seam px-3 py-2 text-sm text-release-paper transition-colors hover:border-release-blaze hover:text-release-blaze">
              Manage founding imports
            </NuxtLink>
            <NuxtLink to="/submit" class="border border-release-seam px-3 py-2 text-sm text-release-paper transition-colors hover:border-release-blaze hover:text-release-blaze">
              Add listing from URL
            </NuxtLink>
          </div>
        </article>
      </section>

      <section class="mt-6 border border-release-seam bg-release-rail">
        <div class="flex items-center justify-between gap-4 border-b border-release-seam px-5 py-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-release-paper-muted">
              Recent activity
            </p>
            <h2 class="mt-1 text-lg font-semibold text-release-paper">
              Latest edited listings
            </h2>
          </div>
          <Button as-child variant="outline" size="sm">
            <NuxtLink to="/admin/listings">
              Open CRUD
            </NuxtLink>
          </Button>
        </div>

        <div class="divide-y divide-release-seam/70">
          <div
            v-for="listing in data.recent_listings"
            :key="listing.id"
            class="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto_auto]"
          >
            <div class="min-w-0">
              <NuxtLink :to="`/admin/listings/${listing.id}`" class="truncate font-medium text-release-paper hover:text-release-blaze">
                {{ listing.name }}
              </NuxtLink>
              <p class="mt-1 truncate text-xs text-release-paper-muted">
                {{ listing.url }}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]" :class="listingStatusClass(listing)">
                {{ listing.status.replace('_', ' ') }}
              </span>
              <span class="border border-release-seam px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-release-paper-muted">
                {{ listing.tier ?? 'no tier' }}
              </span>
            </div>
            <div class="flex items-center justify-start md:justify-end">
              <NuxtLink :to="`/listing/${listing.slug}`" target="_blank" class="text-sm text-release-paper-muted hover:text-release-blaze">
                Public page
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
