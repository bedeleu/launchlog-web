<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { CheckCircle2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PlanTier } from '~/composables/usePlans'
import type { Preview } from '~/composables/usePreviews'
import { toErrorLike } from '~/utils/error-like'
import { resolveCheckoutEmail } from '~/utils/checkout-customer'
import { buildPreviewTextEdit, resolvePreviewCheckout } from '~/utils/preview-checkout'

const route = useRoute()
const token = route.params.token as string
const { getPreview, updatePreview, recapturePreview } = usePreviews()
const { createSession } = useBilling()
const { user, waitForAuthReady } = useAuth()
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
const initialCheckout = resolvePreviewCheckout({
  checkoutReserved: preview.value?.checkout_reserved === true,
  previewTier: preview.value?.tier,
  previewEmail: preview.value?.email,
  draftTier: draft.value?.tier,
  draftEmail: draft.value?.email,
})

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
  email: initialCheckout.email,
})
const authReady = ref(false)
const authenticatedEmail = computed(() => authReady.value ? user.value?.email?.trim() || null : null)
const isAuthenticatedBuyer = computed(() => authenticatedEmail.value !== null)

// Standard is the honest default. Featured remains an explicit upgrade.
const selectedTier = ref<PlanTier>(initialCheckout.tier)
const selectedPlan = computed(() => findPlan(selectedTier.value))
const checkoutReserved = computed(() => preview.value?.checkout_reserved === true)
const checkoutCancelled = computed(() => checkoutReserved.value && route.query.checkout === 'cancelled')

const status = computed(() => preview.value?.status)
const isGenerating = computed(() => status.value === 'generating')
const isFailed = computed(() => status.value === 'failed')
const domainConflict = computed(() => isFailed.value && preview.value?.error_code === 'domain_conflict')
const existingListing = computed(() => preview.value?.existing_listing ?? null)
const claimPath = computed(() => {
  const domain = existingListing.value?.domain || preview.value?.domain || ''
  return `/contact?topic=listing_claim&website=${encodeURIComponent(`https://${domain}`)}`
})
const screenshotFailed = computed(() =>
  isFailed.value && preview.value?.error_code === 'screenshot_failed',
)
const hasScreenshot = computed(() => !!preview.value?.screenshot_url)
const slowGeneration = ref(false)
let slowGenerationTimer: ReturnType<typeof setTimeout> | undefined

// Intake returns immediately with status=generating; crawl + screenshot run in a
// background job (D-057). Poll until ready/failed, filling untouched fields.
const applyPreview = (next: Preview) => {
  preview.value = next
  intake.rememberPreview(next)
  if (!form.title && next.title) form.title = next.title
  if (!form.tagline && next.tagline) form.tagline = next.tagline
  if (!form.description && next.description) form.description = next.description
  if (next.checkout_reserved) {
    const savedCheckout = resolvePreviewCheckout({
      checkoutReserved: true,
      previewTier: next.tier,
      previewEmail: next.email,
      draftTier: selectedTier.value,
      draftEmail: account.email,
    })
    selectedTier.value = savedCheckout.tier
    account.email = savedCheckout.email
  }
  else if (!account.email && next.email) {
    account.email = next.email
  }
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
  if (isGenerating.value) {
    startPolling()
    slowGenerationTimer = setTimeout(() => {
      if (isGenerating.value) slowGeneration.value = true
    }, 45_000)
  }

  void waitForAuthReady().finally(async () => {
    authReady.value = true
    if (user.value?.email && !checkoutReserved.value) account.email = user.value.email
    // SSR cannot inspect the browser's Firebase session. Refresh a conflict
    // once auth is restored so an owner gets Manage rather than a claim form.
    if (domainConflict.value) {
      try {
        applyPreview(await getPreview(token))
      }
      catch {
        // The generic ownership-request route remains safe and usable.
      }
    }
  })
})

onBeforeUnmount(() => {
  if (slowGenerationTimer) clearTimeout(slowGenerationTimer)
})

const emailValue = computed(() => checkoutReserved.value
  ? account.email.trim()
  : resolveCheckoutEmail(authenticatedEmail.value, account.email))
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
  authReady.value
  && !isGenerating.value
  && !domainConflict.value
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
    await updatePreview(token, buildPreviewTextEdit(form))

    // The resolved address always travels to useBilling; useBilling alone
    // decides what reaches the wire, so the page's view of "signed in" and the
    // token actually sent can never disagree and strand the buyer.
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
    checkoutError.value = checkoutReserved.value
      ? 'Your saved checkout could not be reopened. Refresh this page or contact support; nothing has been charged or published.'
      : (toErrorLike(e).data?.message ?? 'We could not start checkout. Please try again.')
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
  <main class="mx-auto max-w-[90rem] px-6 py-12 lg:py-16">
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

      <section
        v-if="isGenerating"
        class="mt-8 overflow-hidden rounded-2xl border border-brand-accent/30 bg-[linear-gradient(110deg,rgba(99,102,241,0.14),rgba(255,255,255,0.025)_48%,rgba(16,185,129,0.06))] px-5 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)] sm:px-6"
        aria-live="polite"
        aria-busy="true"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 items-start gap-3">
            <span class="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-accent/15 ring-1 ring-brand-accent/30">
              <AppSpinner size="size-4" label="Building your preview" />
            </span>
            <div class="min-w-0">
              <p class="font-semibold text-brand-fg">Building your preview</p>
              <p class="mt-1 break-all font-mono text-xs text-brand-muted">{{ preview.domain }}</p>
              <p v-if="slowGeneration" class="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">
                This site is taking a little longer. We’re still working — keep this tab open and checkout will unlock automatically.
              </p>
            </div>
          </div>
          <ol class="grid shrink-0 grid-cols-3 gap-2 text-[11px] sm:w-[25rem]" aria-label="Preview progress">
            <li class="rounded-lg border border-brand-success/25 bg-brand-success/[0.08] px-3 py-2 text-brand-success"><span class="block font-mono">01</span><span class="mt-0.5 block text-white/80">URL accepted</span></li>
            <li class="rounded-lg border border-brand-accent/25 bg-brand-accent/[0.08] px-3 py-2 text-brand-accent"><span class="block font-mono">02</span><span class="mt-0.5 block text-white/80">Reading details</span></li>
            <li class="rounded-lg border border-brand-accent/25 bg-brand-accent/[0.08] px-3 py-2 text-brand-accent"><span class="block font-mono">03</span><span class="mt-0.5 block text-white/80">Capturing site</span></li>
          </ol>
        </div>
      </section>

      <!-- Keep the real product visible while enrichment runs. The buyer can
           understand the placement and plans instead of staring at a fake page. -->
      <div class="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
        <!-- LEFT: the WOW live preview, sticky; plan switches are instant (v-show in the component) -->
        <div class="min-w-0 xl:sticky xl:top-8">
          <IntakePlacementPreview
            class="min-w-0"
            :preview="preview"
            :tier="selectedTier"
            :title="form.title"
            :tagline="form.tagline"
            :generating="isGenerating"
          />

          <div
            v-if="domainConflict"
            class="mt-4 rounded-xl border border-brand-accent/40 bg-[linear-gradient(135deg,rgba(99,102,241,0.13),rgba(255,255,255,0.025))] p-5"
            role="status"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">
              {{ existingListing?.action === 'manage' ? 'Already in your account' : 'Already on LaunchLog' }}
            </p>
            <h2 class="mt-2 text-lg font-semibold text-brand-fg">This website already has a listing.</h2>
            <p class="mt-2 text-sm leading-6 text-brand-muted">
              <template v-if="existingListing?.action === 'manage'">
                Manage the existing listing from your dashboard. We will not create or charge for a duplicate.
              </template>
              <template v-else>
                We never transfer ownership from a URL alone. Send a request and our team will verify control of the domain.
              </template>
            </p>
            <div class="mt-4 flex flex-wrap gap-3">
              <NuxtLink
                v-if="existingListing?.action === 'manage'"
                :to="existingListing.dashboard_path || '/dashboard'"
                class="inline-flex h-10 items-center justify-center rounded-md bg-brand-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60"
              >Manage listing</NuxtLink>
              <NuxtLink
                v-else
                :to="claimPath"
                class="inline-flex h-10 items-center justify-center rounded-md bg-brand-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60"
              >Request ownership</NuxtLink>
              <NuxtLink
                v-if="existingListing?.listing_path"
                :to="existingListing.listing_path"
                class="inline-flex h-10 items-center justify-center rounded-md border border-brand-border px-4 text-sm font-medium text-brand-fg transition-colors hover:border-brand-accent/50 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60"
              >View it</NuxtLink>
            </div>
          </div>

          <!-- Compact warning: the capture failed, publishing still works. -->
          <div
            v-if="!domainConflict && !isGenerating && (isFailed || !hasScreenshot)"
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
          <div v-if="!domainConflict && !isGenerating" class="mt-4">
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
            <IntakePlanSelector
              v-model="selectedTier"
              :disabled="checkoutPending || domainConflict || checkoutReserved"
            />
            <p v-if="checkoutReserved" class="mt-2 text-xs leading-5 text-brand-muted">
              This plan is locked to your saved Stripe checkout so returning cannot create a different order.
            </p>
          </section>

          <!-- 02 — Publishing identity -->
          <section class="space-y-4">
            <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
              {{ checkoutReserved ? '02 — Saved checkout' : isAuthenticatedBuyer ? '02 — Publishing account' : '02 — Where should we send your listing?' }}
            </h2>
            <div
              v-if="checkoutReserved"
              class="rounded-xl border border-brand-accent/35 bg-brand-accent/[0.07] px-4 py-4"
              role="status"
            >
              <p class="text-sm font-semibold text-brand-fg">
                {{ checkoutCancelled ? 'Payment wasn’t completed' : 'Your secure checkout is ready to resume' }}
              </p>
              <p class="mt-1 text-sm leading-6 text-brand-muted">
                <template v-if="checkoutCancelled">Nothing was charged or published. </template>
                Continue with the same {{ selectedPlan.name }} plan for
                <span class="font-medium text-brand-fg">{{ account.email }}</span>.
              </p>
            </div>
            <div
              v-else-if="!authReady"
              class="flex min-h-20 items-center gap-3 rounded-xl border border-brand-border bg-white/[0.02] px-4 py-3"
              aria-busy="true"
              aria-live="polite"
            >
              <AppSpinner class="shrink-0" label="Checking your LaunchLog account" />
              <p class="text-sm text-brand-muted">
                Checking your LaunchLog account…
              </p>
            </div>
            <div
              v-else-if="isAuthenticatedBuyer"
              class="flex items-start gap-3 rounded-xl border border-white/15 bg-white/[0.035] px-4 py-3.5"
            >
              <CheckCircle2 class="mt-0.5 size-5 shrink-0 text-brand-success" aria-hidden="true" />
              <div class="min-w-0">
                <p class="text-xs font-medium uppercase tracking-[0.14em] text-brand-muted">
                  Publishing as
                </p>
                <p class="mt-1 break-words text-sm font-semibold text-brand-fg">
                  {{ authenticatedEmail }}
                </p>
                <p class="mt-1 text-xs leading-5 text-brand-muted">
                  This listing will be added directly to your signed-in account.
                </p>
              </div>
            </div>
            <div v-else class="space-y-1.5">
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
            <div v-if="domainConflict" class="rounded-xl border border-brand-border bg-white/[0.025] p-4 text-center">
              <p class="text-sm font-medium text-brand-fg">This website is already represented on LaunchLog.</p>
              <p class="mt-1 text-xs leading-5 text-brand-muted">No duplicate payment is needed.</p>
              <div class="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                <NuxtLink
                  :to="existingListing?.action === 'manage' ? (existingListing.dashboard_path || '/dashboard') : claimPath"
                  class="text-sm font-medium text-brand-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60"
                >{{ existingListing?.action === 'manage' ? 'Open your dashboard' : 'Request ownership' }}</NuxtLink>
                <NuxtLink
                  v-if="existingListing?.listing_path"
                  :to="existingListing.listing_path"
                  class="text-sm font-medium text-brand-fg underline decoration-white/30 underline-offset-4 transition-colors hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60"
                >View it</NuxtLink>
              </div>
            </div>
            <Button v-else size="lg" class="w-full" :disabled="!canPay" @click="payAndPublish">
              <AppSpinner v-if="checkoutPending" class="mr-2" color="text-current" label="Opening secure checkout" />
              {{ checkoutPending
                ? 'Opening secure checkout…'
                : isGenerating
                  ? 'Preparing preview…'
                  : checkoutReserved
                    ? `Resume secure checkout — ${selectedPlan.priceLabel}/year`
                    : `Pay & publish — ${selectedPlan.priceLabel}/year` }}
            </Button>
            <div class="mt-3 min-h-5 text-center text-xs" aria-live="polite">
              <p v-if="checkoutError" class="text-brand-warning" role="alert">
                {{ checkoutError }}
              </p>
              <p v-else-if="isGenerating" class="text-brand-muted">
                Checkout unlocks automatically when the preview is ready.
              </p>
              <p v-else-if="!domainConflict" class="text-brand-muted">
                That's just {{ selectedPlan.monthlyLabel }}/mo · pay only when you publish · 7-day money-back guarantee.
              </p>
            </div>
          </section>
        </div>
      </div>
    </template>
  </main>
</template>
