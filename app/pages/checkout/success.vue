<script setup lang="ts">
import { CheckCircle2, Clock, LifeBuoy, TriangleAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'

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

type PollState = 'waiting' | 'converted' | 'expired' | 'timeout' | 'unverifiable'

// A missing or malformed token is a controlled state, never a Nuxt 404: the
// customer has already paid and must not land on an error page.
const state = ref<PollState>(token ? 'waiting' : 'unverifiable')
const listingSlug = ref<string | null>(null)

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
  <main class="mx-auto flex min-h-[70vh] max-w-2xl items-center px-6 py-16">
    <div class="w-full rounded-2xl border border-brand-border bg-white/[0.02] p-8 sm:p-10">
      <div aria-live="polite">
        <!-- WAITING -->
        <template v-if="state === 'waiting'">
          <div class="flex items-center gap-3">
            <AppSpinner class="shrink-0" size="size-5" label="Finishing your listing" />
            <h1 class="text-2xl font-bold text-brand-fg">
              Payment received. Finishing your listing…
            </h1>
          </div>
          <p class="mt-3 text-brand-muted">
            We're publishing your listing now. This usually takes a few seconds — keep this page open.
          </p>
        </template>

        <!-- CONVERTED -->
        <template v-else-if="state === 'converted'">
          <div class="flex items-center gap-3">
            <CheckCircle2 class="size-6 shrink-0 text-brand-success" />
            <h1 class="text-2xl font-bold text-brand-fg">
              Your listing is live.
            </h1>
          </div>
          <p class="mt-3 text-brand-muted">
            It's published in the directory with schema.org data, markdown output, and llms.txt inclusion.
          </p>
          <div class="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button as-child size="lg" class="sm:flex-1">
              <NuxtLink :to="`/listing/${listingSlug}`">
                View your listing
              </NuxtLink>
            </Button>
            <Button as-child size="lg" variant="outline" class="sm:flex-1">
              <NuxtLink to="/dashboard">
                Open dashboard
              </NuxtLink>
            </Button>
          </div>
        </template>

        <!-- EXPIRED -->
        <template v-else-if="state === 'expired'">
          <div class="flex items-center gap-3">
            <TriangleAlert class="size-6 shrink-0 text-brand-warning" />
            <h1 class="text-2xl font-bold text-brand-fg">
              This preview expired.
            </h1>
          </div>
          <p class="mt-3 text-brand-muted">
            Previews last 7 days, and this one expired before the listing was published.
            If you were charged, contact us and we'll publish it or refund you.
          </p>
        </template>

        <!-- TIMEOUT -->
        <template v-else-if="state === 'timeout'">
          <div class="flex items-center gap-3">
            <Clock class="size-6 shrink-0 text-brand-accent" />
            <h1 class="text-2xl font-bold text-brand-fg">
              Payment is safe. We are still processing it.
            </h1>
          </div>
          <p class="mt-3 text-brand-muted">
            Your listing is taking longer than usual to publish. Nothing is lost — check again,
            or contact us and we'll finish it for you.
          </p>
          <Button size="lg" class="mt-7 w-full sm:w-auto" @click="startPolling">
            Retry status check
          </Button>
        </template>

        <!-- UNVERIFIABLE -->
        <template v-else>
          <div class="flex items-center gap-3">
            <LifeBuoy class="size-6 shrink-0 text-brand-muted" />
            <h1 class="text-2xl font-bold text-brand-fg">
              We can't check this listing's status.
            </h1>
          </div>
          <p class="mt-3 text-brand-muted">
            This link is missing the preview reference, so we can't look up your listing.
            If you completed a payment, contact us with your receipt and we'll sort it out.
          </p>
        </template>
      </div>

      <!-- Support + Stripe reference, always available after a payment. -->
      <div
        v-if="state !== 'converted'"
        class="mt-8 border-t border-brand-border pt-6 text-sm text-brand-muted"
      >
        <p>
          Need help? Email
          <a href="mailto:support@launchlog.ai" class="font-medium text-brand-accent hover:underline">support@launchlog.ai</a>.
        </p>
        <p v-if="sessionId" class="mt-2">
          Stripe session ID:
          <span class="break-all font-mono text-xs text-brand-fg">{{ sessionId }}</span>
        </p>
      </div>
    </div>
  </main>
</template>
