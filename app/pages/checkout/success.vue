<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { checkoutReleaseCopy, type CheckoutReleaseState } from '~/utils/checkout-release-state'

const route = useRoute()
const { getConversion } = useBilling()

// Post-payment surface — never indexable (D-057).
useSeoMeta({
  title: 'Finishing your listing | LaunchLog',
  robots: 'noindex, nofollow',
})

// Preview tokens are exactly 64 url-safe chars (Str::random(64) server-side).
// Anything else can only be a mangled link — never worth a request.
const TOKEN_PATTERN = /^[A-Za-z0-9]{64}$/
const rawToken = typeof route.query.preview === 'string' ? route.query.preview.trim() : ''
const token = TOKEN_PATTERN.test(rawToken) ? rawToken : ''
// Display/support only — the conversion endpoint is keyed by the preview token.
const sessionId = typeof route.query.session_id === 'string' ? route.query.session_id.trim() : ''

// A missing or malformed token is a controlled state, never a Nuxt 404: the
// customer has already paid and must not land on an error page.
const state = ref<CheckoutReleaseState>(token ? 'waiting' : 'unverifiable')
const listingSlug = ref<string | null>(null)
const releaseCopy = computed(() => checkoutReleaseCopy(state.value))

const POLL_INTERVAL_MS = 2000
const POLL_DEADLINE_MS = 60000

// One round = one deadline. runId invalidates everything from an older round,
// so a late response, catch or timer can never write into the current one.
let runId = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
let deadlineTimer: ReturnType<typeof setTimeout> | null = null
let controller: AbortController | null = null

const cleanup = () => {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  if (deadlineTimer) {
    clearTimeout(deadlineTimer)
    deadlineTimer = null
  }
  // Abort whatever is in flight: nothing outlives its round.
  controller?.abort()
  controller = null
}

const poll = async (id: number, deadline: number) => {
  if (id !== runId) return
  retryTimer = null

  // Checked BEFORE the request, so a retry scheduled near the edge never
  // starts past the deadline.
  if (Date.now() >= deadline) {
    state.value = 'timeout'
    cleanup()
    return
  }

  controller = new AbortController()

  try {
    const result = await getConversion(token, controller.signal)
    if (id !== runId) return

    // Only a slug can produce a listing link — never route to /listing/null.
    if (result.status === 'converted' && result.listing_slug) {
      listingSlug.value = result.listing_slug
      state.value = 'converted'
      cleanup()
      return
    }

    if (result.status === 'expired') {
      state.value = 'expired'
      cleanup()
      return
    }
  }
  catch {
    // Transient failures, including a 404 while the conversion propagates and
    // the abort fired at the deadline, must not present the payment as failed.
    if (id !== runId) return
  }

  if (id !== runId) return

  if (Date.now() >= deadline) {
    state.value = 'timeout'
    cleanup()
    return
  }

  retryTimer = setTimeout(() => poll(id, deadline), POLL_INTERVAL_MS)
}

const startPolling = () => {
  // Retry fully cancels the previous round before opening a new one.
  cleanup()
  const id = ++runId
  const deadline = Date.now() + POLL_DEADLINE_MS

  state.value = 'waiting'
  listingSlug.value = null

  // Hard stop on real elapsed time: fires even while a request hangs.
  deadlineTimer = setTimeout(() => {
    if (id !== runId) return
    state.value = 'timeout'
    cleanup()
  }, POLL_DEADLINE_MS)

  // First check runs immediately; the interval only paces the retries.
  poll(id, deadline)
}

// Client-only: no polling during SSR.
onMounted(() => {
  if (token) startPolling()
})

onBeforeUnmount(() => {
  runId++
  cleanup()
})
</script>

<template>
  <div class="min-h-[72vh] px-4 py-10 sm:px-6 sm:py-16">
    <ReleaseShell
      compact
      :eyebrow="releaseCopy.eyebrow"
      :title="releaseCopy.title"
      :description="releaseCopy.description"
      class="max-w-5xl"
    >
      <div class="grid gap-5 border border-release-seam bg-release-rail p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div class="min-w-0">
          <ReleaseStateMarker
            :label="releaseCopy.marker"
            :detail="releaseCopy.markerDetail"
            :state="releaseCopy.tone"
            :live="true"
          />

          <div v-if="state === 'waiting'" class="mt-6 flex items-center gap-3 border-t border-release-seam pt-5">
            <AppSpinner class="shrink-0" size="size-4" label="Checking signed publication status" />
            <p class="font-mono text-[0.68rem] font-semibold tracking-[0.12em] text-release-paper-muted uppercase">
              Checking signed publication status…
            </p>
          </div>

          <div v-else-if="state === 'converted'" class="mt-6 flex flex-col gap-3 border-t border-release-seam pt-5 sm:flex-row">
            <Button as-child size="lg" class="sm:flex-1">
              <NuxtLink :to="`/listing/${listingSlug}`">View public release</NuxtLink>
            </Button>
            <Button as-child size="lg" variant="outline" class="sm:flex-1">
              <NuxtLink to="/dashboard">Open dashboard</NuxtLink>
            </Button>
          </div>

          <Button v-else-if="state === 'timeout'" size="lg" class="mt-6 w-full sm:w-auto" @click="startPolling">
            Retry status check
          </Button>
        </div>

        <aside class="border-t border-release-seam pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
          <p class="font-mono text-[0.62rem] font-semibold tracking-[0.16em] text-release-warning uppercase">
            Release reference
          </p>
          <p class="mt-3 text-sm leading-6 text-release-paper-muted">
            Need help? Email
            <a href="mailto:support@launchlog.ai" class="font-medium text-release-paper underline decoration-release-warning underline-offset-4">support@launchlog.ai</a>.
          </p>
          <p v-if="sessionId" class="mt-4 border-t border-release-seam pt-4">
            <span class="block font-mono text-[0.6rem] font-semibold tracking-[0.14em] text-release-paper-muted uppercase">Stripe session</span>
            <span class="mt-1 block break-all font-mono text-[0.66rem] leading-5 text-[#f6f1e7]">{{ sessionId }}</span>
          </p>
        </aside>
      </div>
    </ReleaseShell>
  </div>
</template>
