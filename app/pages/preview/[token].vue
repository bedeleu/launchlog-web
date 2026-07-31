<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PlanTier } from '~/composables/usePlans'
import type { Preview } from '~/composables/usePreviews'
import { toErrorLike } from '~/utils/error-like'

const route = useRoute()
const token = route.params.token as string
const { getPreview, updatePreview, recapturePreview } = usePreviews()
const { createSession } = useBilling()
const { findPlan } = usePlans()
const intake = useIntakeStore()

// Private artifact — must never be indexed (D-057).
useSeoMeta({
  title: 'Your listing preview | LaunchLog',
  robots: 'noindex, nofollow',
})

const { data: preview, error } = await useAsyncData(`preview-${token}`, () => getPreview(token))
if (preview.value) {
  intake.rememberPreview(preview.value)
  // Single place where the tier chosen on /pricing is consumed, so every entry
  // path lands here: new preview, resumed submit, the Resume link, or a direct
  // URL. One-shot — afterwards the draft is the only source of truth.
  intake.applyPreferredTier(token)
}

// Already paid: the success page owns the post-payment surface and resolves
// the published slug, so never leave the buyer on a dead order form.
if (preview.value?.status === 'converted') {
  await navigateTo(`/checkout/success?preview=${token}`, { replace: true })
}

const draft = computed(() => intake.getDraft(token))

// Listing text (defaults from the crawl). Edited via a discreet inline panel,
// not a primary step — buying shouldn't feel like an editor.
const form = reactive({
  title: draft.value?.title ?? preview.value?.title ?? '',
  tagline: draft.value?.tagline ?? preview.value?.tagline ?? '',
  description: draft.value?.description ?? preview.value?.description ?? '',
})
const showEdit = ref(false)

// Account: email only. The account itself is created server-side after the
// payment webhook (D-057) — no password, no coupon, nothing to fill in twice.
const account = reactive({
  email: draft.value?.email ?? preview.value?.email ?? '',
})

// Featured is the default selection — the most valuable placement (D-058).
const selectedTier = ref<PlanTier>(draft.value?.tier ?? 'featured')
const selectedPlan = computed(() => findPlan(selectedTier.value))

const status = computed(() => preview.value?.status)
const isGenerating = computed(() => status.value === 'generating')
const isFailed = computed(() => status.value === 'failed')
const screenshotFailed = computed(() =>
  isFailed.value && preview.value?.error_code === 'screenshot_failed',
)
const hasScreenshot = computed(() => !!preview.value?.screenshot_url)

// Intake returns immediately with status=generating; crawl + screenshot run in a
// background job (D-057). Poll until ready/failed, filling untouched fields.
const applyPreview = (next: Preview) => {
  preview.value = next
  intake.rememberPreview(next)
  if (!form.title && next.title) form.title = next.title
  if (!form.tagline && next.tagline) form.tagline = next.tagline
  if (!form.description && next.description) form.description = next.description
  if (!account.email && next.email) account.email = next.email
}

const { pause: stopPolling, resume: startPolling } = useIntervalFn(async () => {
  if (!isGenerating.value) {
    stopPolling()
    return
  }
  try {
    const next = await getPreview(token)
    applyPreview(next)
    if (next.status !== 'generating') stopPolling()
  }
  catch {
    // Transient failure — keep polling on the next tick.
  }
}, 1800, { immediate: false })

const recapturing = ref(false)
const recaptureError = ref<string | null>(null)
const recapture = async () => {
  if (recapturing.value) return

  recapturing.value = true
  recaptureError.value = null

  try {
    applyPreview(await recapturePreview(token))
    startPolling()
  }
  catch {
    recaptureError.value = 'Could not start a new capture. Please try again.'
  }
  finally {
    recapturing.value = false
  }
}

onMounted(() => {
  if (isGenerating.value) startPolling()
})

const emailValue = computed(() => account.email.trim())
const emailLooksValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue.value))
const attemptedPublish = ref(false)
const emailShowsInvalid = computed(() => attemptedPublish.value && !emailLooksValid.value)
const emailHelpText = computed(() => {
  if (!emailValue.value) return attemptedPublish.value ? 'Enter your email to continue to checkout.' : 'Required for checkout.'
  if (!emailLooksValid.value) return attemptedPublish.value ? 'Enter a valid email address.' : 'We will validate this before checkout.'
  return 'We will create your account with this email after checkout.'
})
const invalidFieldClass = 'border-brand-warning/70 shadow-[0_0_0_1px_rgba(245,158,11,0.32),0_0_18px_rgba(245,158,11,0.14)] focus-visible:ring-brand-warning/25'

const checkoutPending = ref(false)
const checkoutError = ref<string | null>(null)

// Payment is blocked only by things that genuinely prevent checkout. A missing
// or failed screenshot never blocks it — the API decides whether the remaining
// data can be published, and the screenshot can be recaptured afterwards.
const canPay = computed(() =>
  !isGenerating.value
  && emailLooksValid.value
  && !checkoutPending.value,
)

const payAndPublish = async () => {
  attemptedPublish.value = true
  if (!canPay.value) return

  checkoutPending.value = true
  checkoutError.value = null
  // Pinned BEFORE the first await and reused by both calls: the plan and
  // address that reach Stripe are exactly the ones this click selected, even
  // if the selector or the field changes while the requests are in flight.
  const email = emailValue.value
  const tier = selectedTier.value
  let redirecting = false

  try {
    // Save first: if the edits cannot be persisted, no session is created.
    await updatePreview(token, {
      title: form.title || null,
      tagline: form.tagline || null,
      description: form.description || null,
      email,
      tier,
    })

    const session = await createSession({
      preview_token: token,
      tier,
      email,
    })

    if (!session.url) {
      checkoutError.value = 'Checkout could not be opened. Please try again or contact support.'
      return
    }

    redirecting = true
    window.location.href = session.url
  }
  catch (e: unknown) {
    checkoutError.value = toErrorLike(e).data?.message
      ?? 'We could not start checkout. Please try again.'
  }
  finally {
    // Keep the button locked while the browser is leaving for Stripe.
    if (!redirecting) checkoutPending.value = false
  }
}

// Persist to the store as the user types, for resume after refresh/tab close.
watch(
  [() => form.title, () => form.tagline, () => form.description, () => account.email, selectedTier],
  () => {
    intake.updateDraft(token, {
      title: form.title,
      tagline: form.tagline,
      description: form.description,
      email: account.email,
      tier: selectedTier.value,
    })
  },
)
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-12 lg:py-16">
    <!-- Not found / expired -->
    <div v-if="error || !preview" class="py-16 text-center">
      <h1 class="text-3xl font-bold text-brand-fg">
        Preview not found
      </h1>
      <p class="mx-auto mt-3 max-w-md text-brand-muted">
        This preview may have expired (previews last 7 days) or the link is invalid.
      </p>
      <NuxtLink to="/" class="mt-6 inline-block text-brand-accent underline">
        Start a new preview
      </NuxtLink>
    </div>

    <template v-else>
      <header class="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div class="max-w-2xl">
          <h1 class="text-3xl font-bold text-brand-fg lg:text-4xl">
            Review &amp; publish your listing
          </h1>
          <p class="mt-2 text-brand-muted">
            See how your product will appear, pick a package, and publish. Pay only when you publish.
          </p>
        </div>
        <NuxtLink
          to="/"
          class="inline-flex h-10 items-center justify-center rounded-md border border-brand-border px-4 text-sm text-brand-muted transition-colors hover:border-brand-accent/50 hover:text-brand-fg"
        >
          Start over
        </NuxtLink>
      </header>

      <!-- GENERATING: a skeleton of the order-page layout (no half-empty content,
           no spinner stuck on a screenshot). Replaced seamlessly when ready. -->
      <div v-if="isGenerating" class="mt-8">
        <div class="mb-6 flex items-center gap-2.5 text-sm text-brand-muted">
          <AppSpinner class="shrink-0" />
          <p>Generating your preview — capturing the screenshot and details…</p>
        </div>
        <div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          <!-- left: browser-framed screenshot skeleton -->
          <div class="min-w-0">
            <div class="overflow-hidden rounded-2xl border border-brand-border bg-[#0c1120]">
              <div class="flex items-center gap-2 border-b border-brand-border bg-white/[0.03] px-4 py-2.5">
                <span class="size-2.5 rounded-full bg-white/10" />
                <span class="size-2.5 rounded-full bg-white/10" />
                <span class="size-2.5 rounded-full bg-white/10" />
              </div>
              <div class="aspect-[16/10] w-full animate-pulse bg-white/[0.04]" />
            </div>
          </div>
          <!-- right: order-form skeleton -->
          <div class="min-w-0 space-y-8">
            <div class="space-y-3">
              <div class="h-3 w-28 animate-pulse rounded bg-white/[0.06]" />
              <div class="h-20 animate-pulse rounded-xl bg-white/[0.04]" />
              <div class="h-20 animate-pulse rounded-xl bg-white/[0.04]" />
            </div>
            <div class="space-y-3">
              <div class="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
              <div class="h-10 animate-pulse rounded-md bg-white/[0.04]" />
            </div>
            <div class="h-11 animate-pulse rounded-md bg-white/[0.05]" />
          </div>
        </div>
      </div>

      <!-- ORDER PAGE — live preview left, order form right. Shown for ready AND
           failed previews: a missing screenshot never blocks checkout. -->
      <div v-else class="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <!-- LEFT: the WOW live preview, sticky; plan switches are instant (v-show in the component) -->
        <div class="min-w-0 lg:sticky lg:top-8">
          <IntakePlacementPreview
            class="min-w-0"
            :preview="preview"
            :tier="selectedTier"
            :title="form.title"
            :tagline="form.tagline"
          />

          <!-- Compact warning: the capture failed, publishing still works. -->
          <div
            v-if="isFailed || !hasScreenshot"
            class="mt-4 rounded-xl border border-brand-warning/40 bg-brand-warning/[0.07] p-4"
            role="status"
          >
            <p class="text-sm font-medium text-brand-fg">
              <template v-if="screenshotFailed || !hasScreenshot">
                We couldn't capture a screenshot for this site.
              </template>
              <template v-else>
                We couldn't finish building this preview.
              </template>
            </p>
            <p class="mt-1 text-sm text-brand-muted">
              You can still publish your listing now — we'll show the placeholder until a capture succeeds,
              and you can retry the screenshot at any time.
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-4">
              <Button type="button" variant="outline" size="sm" :disabled="recapturing" @click="recapture">
                <AppSpinner v-if="recapturing" class="mr-2" color="text-current" label="Starting a new capture" />
                {{ recapturing ? 'Starting…' : 'Capture again' }}
              </Button>
              <NuxtLink to="/" class="text-sm text-brand-accent underline underline-offset-4">
                Try another URL
              </NuxtLink>
            </div>
            <p v-if="recaptureError" class="mt-3 text-sm text-brand-warning" role="alert">
              {{ recaptureError }}
            </p>
          </div>

          <!-- Discreet listing-text editor — not a step; defaults come from the crawl -->
          <div class="mt-4">
            <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                type="button"
                class="text-xs font-medium text-brand-accent underline underline-offset-4"
                @click="showEdit = !showEdit"
              >
                {{ showEdit ? 'Done editing text' : 'Edit listing text' }}
              </button>
              <button
                v-if="hasScreenshot"
                type="button"
                class="text-xs font-medium text-brand-muted underline decoration-white/20 underline-offset-4 transition-colors hover:text-brand-fg disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="recapturing"
                @click="recapture"
              >
                {{ recapturing ? 'Starting new capture…' : 'Screenshot not right? Capture again' }}
              </button>
            </div>
            <p v-if="recaptureError && hasScreenshot" class="mt-2 text-xs text-brand-warning" role="alert">
              {{ recaptureError }}
            </p>
            <div v-show="showEdit" class="mt-3 space-y-3 rounded-xl border border-brand-border bg-white/[0.02] p-4">
              <div class="space-y-1.5">
                <Label for="f-title">Title</Label>
                <Input id="f-title" v-model="form.title" placeholder="Your product name" />
              </div>
              <div class="space-y-1.5">
                <Label for="f-tagline">Tagline</Label>
                <Input id="f-tagline" v-model="form.tagline" placeholder="One line about what you do" />
              </div>
              <div class="space-y-1.5">
                <Label for="f-description">Description</Label>
                <textarea
                  id="f-description"
                  v-model="form.description"
                  rows="4"
                  placeholder="A short description of your product"
                  style="field-sizing: content"
                  class="max-h-60 min-h-20 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: order form (package + email) -->
        <div class="min-w-0 space-y-8">
          <!-- 01 — Select package -->
          <section>
            <h2 class="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
              01 — Select package
            </h2>
            <IntakePlanSelector v-model="selectedTier" :disabled="checkoutPending" />
          </section>

          <!-- 02 — Email -->
          <section class="space-y-4">
            <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
              02 — Where should we send your listing?
            </h2>
            <div class="space-y-1.5">
              <div class="flex min-h-5 items-center justify-between gap-3">
                <Label for="a-email">Email address</Label>
                <span
                  class="text-right text-[11px] font-medium"
                  :class="emailShowsInvalid ? 'text-brand-warning' : 'text-brand-muted'"
                >
                  {{ emailShowsInvalid ? 'Invalid email' : 'Required' }}
                </span>
              </div>
              <Input
                id="a-email"
                v-model="account.email"
                type="email"
                placeholder="you@yourproduct.com"
                :aria-invalid="emailShowsInvalid"
                :class="emailShowsInvalid ? invalidFieldClass : ''"
              />
              <p
                class="min-h-4 text-xs"
                :class="emailShowsInvalid ? 'text-brand-warning' : 'text-brand-muted'"
                aria-live="polite"
              >
                {{ emailHelpText }}
              </p>
            </div>
          </section>

          <!-- CTA -->
          <section>
            <Button size="lg" class="w-full" :disabled="!canPay" @click="payAndPublish">
              <AppSpinner v-if="checkoutPending" class="mr-2" color="text-current" label="Opening secure checkout" />
              {{ checkoutPending ? 'Opening secure checkout…' : `Pay & publish — ${selectedPlan.priceLabel}/year` }}
            </Button>
            <div class="mt-3 min-h-5 text-center text-xs" aria-live="polite">
              <p v-if="checkoutError" class="text-brand-warning" role="alert">
                {{ checkoutError }}
              </p>
              <p v-else class="text-brand-muted">
                That's just {{ selectedPlan.monthlyLabel }}/mo · pay only when you publish · 7-day money-back guarantee.
              </p>
            </div>
          </section>
        </div>
      </div>
    </template>
  </main>
</template>
