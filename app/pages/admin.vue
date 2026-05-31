<script setup lang="ts">
import { ArrowRight, Camera, CheckCircle2, Clock3, FilePlus2, Gauge, ListChecks, ShieldCheck, Sparkles } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { AdminDashboard, AdminListing, FounderScreenshotStatus } from '~/composables/useAdminListings'

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
  catch (e: any) {
    error.value = e?.data?.message ?? e?.data?.error ?? e?.message ?? 'Could not load admin dashboard'
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
  catch (e: any) {
    error.value = e?.data?.message ?? e?.data?.error ?? e?.message ?? 'Could not start screenshot batch'
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
      accent: 'text-emerald-300',
    },
    {
      label: 'Pending review',
      value: totals?.pending_review ?? 0,
      detail: 'Needs moderation',
      icon: Clock3,
      accent: 'text-amber-300',
    },
    {
      label: 'R2 screenshots ready',
      value: totals?.with_screenshots ?? 0,
      detail: `${data.value?.coverage.screenshot_percent ?? 0}% CDN coverage`,
      icon: Camera,
      accent: 'text-cyan-300',
    },
    {
      label: 'Total records',
      value: totals?.listings ?? 0,
      detail: 'All statuses',
      icon: Gauge,
      accent: 'text-slate-200',
    },
  ]
})

const tierRows = computed<Array<[string, number]>>(() => {
  const counts = data.value?.tier_counts ?? {}
  return [
    ['Basic', counts.basic ?? 0],
    ['Premium', counts.premium ?? 0],
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
  if (listing.status === 'published') return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
  if (listing.status === 'pending_review') return 'border-amber-400/30 bg-amber-400/10 text-amber-300'
  if (listing.status === 'rejected') return 'border-red-400/30 bg-red-400/10 text-red-300'
  return 'border-white/10 bg-white/[0.04] text-slate-400'
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
  <main class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
          LaunchLog operations
        </p>
        <h1 class="mt-3 text-3xl font-semibold tracking-tight text-brand-fg sm:text-4xl">
          Admin dashboard
        </h1>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-brand-muted">
          Manage listings, moderation, founding screenshots, and public directory quality from one place.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button as-child variant="outline">
          <NuxtLink to="/admin/listings">
            <ListChecks class="mr-2 size-4" />
            Listings
          </NuxtLink>
        </Button>
        <Button as-child>
          <NuxtLink to="/admin/listings/new">
            <FilePlus2 class="mr-2 size-4" />
            New listing
          </NuxtLink>
        </Button>
      </div>
    </div>

    <div v-if="loading" class="mt-16 flex items-center justify-center rounded-lg border border-brand-border bg-white/[0.03] py-20">
      <AppSpinner label="Loading admin dashboard" />
    </div>

    <p v-else-if="error" class="mt-8 rounded-lg border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">
      {{ error }}
    </p>

    <template v-else-if="data">
      <section class="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="kpi in kpis"
          :key="kpi.label"
          class="rounded-lg border border-brand-border bg-white/[0.035] p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-medium uppercase tracking-[0.18em] text-brand-muted">
                {{ kpi.label }}
              </p>
              <p class="mt-3 text-3xl font-semibold text-brand-fg">
                {{ numberFormat.format(kpi.value) }}
              </p>
            </div>
            <component :is="kpi.icon" class="size-5" :class="kpi.accent" />
          </div>
          <p class="mt-3 text-sm text-brand-muted">
            {{ kpi.detail }}
          </p>
        </article>
      </section>

      <section class="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <article class="rounded-lg border border-brand-border bg-white/[0.035] p-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-brand-muted">
                Directory health
              </p>
              <h2 class="mt-2 text-xl font-semibold text-brand-fg">
                Screenshot and moderation pipeline
              </h2>
            </div>
            <ShieldCheck class="size-5 text-emerald-300" />
          </div>

          <div class="mt-6 grid gap-3 sm:grid-cols-3">
            <div class="rounded-md border border-white/10 bg-black/20 p-3">
              <p class="text-xs text-brand-muted">Missing R2 screenshots</p>
              <p class="mt-2 text-2xl font-semibold text-brand-fg">
                {{ numberFormat.format(data.totals.missing_screenshots) }}
              </p>
            </div>
            <div class="rounded-md border border-white/10 bg-black/20 p-3">
              <p class="text-xs text-brand-muted">Founding backlog</p>
              <p class="mt-2 text-2xl font-semibold text-brand-fg">
                {{ numberFormat.format(data.totals.founding_missing_screenshots) }}
              </p>
            </div>
            <div class="rounded-md border border-white/10 bg-black/20 p-3">
              <p class="text-xs text-brand-muted">CDN screenshot coverage</p>
              <p class="mt-2 text-2xl font-semibold text-brand-fg">
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
            <div class="rounded-md border border-emerald-400/20 bg-emerald-400/10 p-2">
              <p class="text-[11px] uppercase tracking-[0.16em] text-emerald-300">Captured</p>
              <p class="mt-1 text-lg font-semibold text-brand-fg">{{ lastBatchSummary.captured }}</p>
            </div>
            <div class="rounded-md border border-cyan-400/20 bg-cyan-400/10 p-2">
              <p class="text-[11px] uppercase tracking-[0.16em] text-cyan-300">Reused</p>
              <p class="mt-1 text-lg font-semibold text-brand-fg">{{ lastBatchSummary.reused }}</p>
            </div>
            <div class="rounded-md border border-white/10 bg-black/20 p-2">
              <p class="text-[11px] uppercase tracking-[0.16em] text-brand-muted">Skipped</p>
              <p class="mt-1 text-lg font-semibold text-brand-fg">{{ lastBatchSummary.skipped }}</p>
            </div>
            <div class="rounded-md border p-2" :class="lastBatchSummary.failed > 0 ? 'border-amber-400/30 bg-amber-400/10' : 'border-white/10 bg-black/20'">
              <p class="text-[11px] uppercase tracking-[0.16em]" :class="lastBatchSummary.failed > 0 ? 'text-amber-300' : 'text-brand-muted'">Failed</p>
              <p class="mt-1 text-lg font-semibold text-brand-fg">{{ lastBatchSummary.failed }}</p>
            </div>
          </div>
          <p v-if="lastBatchSummary" class="mt-2 text-xs leading-5 text-brand-muted">
            Captured = new screenshot written now. Reused = an existing R2 snapshot was attached to the listing. Failed does not count as ready.
          </p>
          <p v-if="screenshotLimitNotice" class="mt-3 rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
            {{ screenshotLimitNotice }}
          </p>

          <div v-if="screenshotMessage || screenshotStatus?.log_file" class="mt-5 rounded-md border border-white/10 bg-black/25 p-3">
            <p v-if="screenshotMessage" class="text-sm text-emerald-300">
              {{ screenshotMessage }}
            </p>
            <div v-if="screenshotStatus?.log_file" class="mt-3">
              <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-muted">
                <span>{{ screenshotStatus.log_file }}</span>
                <button type="button" class="text-emerald-300 hover:text-emerald-200" @click="refreshScreenshotStatus">
                  Refresh log
                </button>
              </div>
              <pre class="mt-3 max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-brand-muted">{{ screenshotStatus.tail.join('\n') }}</pre>
            </div>
          </div>
        </article>

        <article class="rounded-lg border border-brand-border bg-white/[0.035] p-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-brand-muted">
                Package mix
              </p>
              <h2 class="mt-2 text-xl font-semibold text-brand-fg">
                Billing tiers
              </h2>
            </div>
            <Sparkles class="size-5 text-cyan-300" />
          </div>

          <div class="mt-5 space-y-3">
            <div v-for="[label, count] in tierRows" :key="label" class="flex items-center justify-between border-b border-white/10 pb-3 last:border-0 last:pb-0">
              <span class="text-sm text-brand-muted">{{ label }}</span>
              <span class="font-medium text-brand-fg">{{ numberFormat.format(count) }}</span>
            </div>
          </div>
        </article>
      </section>

      <section class="mt-6 grid gap-4 lg:grid-cols-3">
        <article class="rounded-lg border border-brand-border bg-white/[0.035] p-5">
          <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
            Status
          </h2>
          <div class="mt-4 space-y-3">
            <div v-for="[label, count] in statusRows" :key="label" class="flex items-center justify-between">
              <span class="text-sm text-brand-muted">{{ label }}</span>
              <span class="font-medium text-brand-fg">{{ numberFormat.format(count) }}</span>
            </div>
          </div>
        </article>

        <article class="rounded-lg border border-brand-border bg-white/[0.035] p-5">
          <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
            Source
          </h2>
          <div class="mt-4 space-y-3">
            <div v-for="[label, count] in sourceRows" :key="label" class="flex items-center justify-between">
              <span class="text-sm text-brand-muted">{{ label }}</span>
              <span class="font-medium text-brand-fg">{{ numberFormat.format(count) }}</span>
            </div>
          </div>
        </article>

        <article class="rounded-lg border border-brand-border bg-white/[0.035] p-5">
          <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
            Fast actions
          </h2>
          <div class="mt-4 grid gap-2">
            <NuxtLink to="/admin/listings?status=pending_review" class="rounded-md border border-white/10 px-3 py-2 text-sm text-brand-fg transition-colors hover:border-emerald-300/40 hover:text-emerald-300">
              Review pending listings
            </NuxtLink>
            <NuxtLink to="/admin/listings?source=founding" class="rounded-md border border-white/10 px-3 py-2 text-sm text-brand-fg transition-colors hover:border-emerald-300/40 hover:text-emerald-300">
              Manage founding imports
            </NuxtLink>
            <NuxtLink to="/admin/listings/new" class="rounded-md border border-white/10 px-3 py-2 text-sm text-brand-fg transition-colors hover:border-emerald-300/40 hover:text-emerald-300">
              Create manual listing
            </NuxtLink>
          </div>
        </article>
      </section>

      <section class="mt-6 rounded-lg border border-brand-border bg-white/[0.035]">
        <div class="flex items-center justify-between gap-4 border-b border-brand-border px-5 py-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-brand-muted">
              Recent activity
            </p>
            <h2 class="mt-1 text-lg font-semibold text-brand-fg">
              Latest edited listings
            </h2>
          </div>
          <Button as-child variant="outline" size="sm">
            <NuxtLink to="/admin/listings">
              Open CRUD
            </NuxtLink>
          </Button>
        </div>

        <div class="divide-y divide-brand-border/70">
          <div
            v-for="listing in data.recent_listings"
            :key="listing.id"
            class="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto_auto]"
          >
            <div class="min-w-0">
              <NuxtLink :to="`/admin/listings/${listing.id}`" class="truncate font-medium text-brand-fg hover:text-emerald-300">
                {{ listing.name }}
              </NuxtLink>
              <p class="mt-1 truncate text-xs text-brand-muted">
                {{ listing.url }}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]" :class="listingStatusClass(listing)">
                {{ listing.status.replace('_', ' ') }}
              </span>
              <span class="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                {{ listing.tier ?? 'no tier' }}
              </span>
            </div>
            <div class="flex items-center justify-start md:justify-end">
              <NuxtLink :to="`/listing/${listing.slug}`" target="_blank" class="text-sm text-brand-muted hover:text-emerald-300">
                Public page
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>
    </template>
  </main>
</template>
