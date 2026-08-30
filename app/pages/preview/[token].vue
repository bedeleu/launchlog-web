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
import {
  clearCheckoutReturnMarker,
  hasCheckoutReturnMarker,
  markCheckoutRedirect,
  reconcileCancelledCheckout,
} from '~/utils/checkout-cancellation'
import { buildPreviewTextEdit, firstPreviewCopyError, resolvePreviewCheckout } from '~/utils/preview-checkout'
import { resolvePreviewPublishingMode } from '~/utils/preview-publishing'
import { resolvePreviewAuthAccess } from '~/utils/preview-auth-access'

const route = useRoute()
const router = useRouter()
const token = route.params.token as string
const { getPreview, updatePreview, recapturePreview, cancelPreviewCheckout } = usePreviews()
const { createSession } = useBilling()
const { user, waitForAuthReady, isAdmin: resolveIsAdmin } = useAuth()
const { publishPreview: publishAdminPreview } = useAdminListings()
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
const primaryCategoryId = ref<string | null>(preview.value?.primary_category_id ?? null)
const showEdit = ref(false)
const previewCopyError = computed(() => firstPreviewCopyError(form))

watch(previewCopyError, (copyError) => {
  if (copyError) showEdit.value = true
}, { immediate: true })

// Account: email only. The account itself is created server-side after the
// payment webhook (D-057) — no password, no coupon, nothing to fill in twice.
const account = reactive({
  email: initialCheckout.email,
})
const authReady = ref(false)
const authAccessState = ref<'checking' | 'ready' | 'unavailable'>('checking')
const isAdminAccount = ref(false)
const authenticatedEmail = computed(() => authReady.value ? user.value?.email?.trim() || null : null)
const isAuthenticatedBuyer = computed(() => authenticatedEmail.value !== null)

// Standard is the honest default. Featured remains an explicit upgrade.
const selectedTier = ref<PlanTier>(initialCheckout.tier)
const selectedPlan = computed(() => findPlan(selectedTier.value))
const checkoutReserved = computed(() => preview.value?.checkout_reserved === true)
const publishingMode = computed(() => resolvePreviewPublishingMode({
  authReady: authReady.value,
  isAdmin: isAdminAccount.value,
  checkoutReserved: checkoutReserved.value,
}))
const checkoutCancellationState = ref<'idle' | 'pending' | 'done' | 'error'>(
  route.query.checkout === 'cancelled' ? 'pending' : 'idle',
)
let checkoutCancellationRunning = false

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
  if (!primaryCategoryId.value && next.primary_category_id) primaryCategoryId.value = next.primary_category_id
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

const checkoutReturnStorage = () => {
  try {
    return window.sessionStorage
  }
  catch {
    return null
  }
}

const reconcileStripeBack = async () => {
  const returnedFromCheckout = route.query.checkout === 'cancelled'
    || hasCheckoutReturnMarker(checkoutReturnStorage(), token)

  if (!returnedFromCheckout || checkoutCancellationRunning) return

  checkoutCancellationRunning = true
  checkoutCancellationState.value = 'pending'
  const result = await reconcileCancelledCheckout({
    returnedFromCheckout: true,
    refresh: () => getPreview(token),
    isCheckoutReserved: current => current.checkout_reserved === true,
    cancel: () => cancelPreviewCheckout(token),
    clearReturnState: async () => {
      if (route.query.checkout === 'cancelled') {
        const query = { ...route.query }
        delete query.checkout
        await router.replace({ query })
      }
      clearCheckoutReturnMarker(checkoutReturnStorage(), token)
    },
  })

  if (result.state === 'done' && result.preview) {
    applyPreview(result.preview)
    track('Payment Canceled')
  }
  checkoutCancellationState.value = result.state === 'idle' ? 'idle' : result.state
  checkoutCancellationRunning = false
}

const handlePageShow = () => {
  void reconcileStripeBack()
}

let authAccessAttempt = 0
const verifyPublishingAccess = async () => {
  const attempt = ++authAccessAttempt
  authAccessState.value = 'checking'
  authReady.value = false
  isAdminAccount.value = false

  const access = await resolvePreviewAuthAccess({
    waitForAuthReady,
    hasUser: () => user.value !== null,
    isAdmin: resolveIsAdmin,
  })

  if (attempt !== authAccessAttempt) return

  if (access.kind === 'unavailable') {
    authAccessState.value = 'unavailable'
    return
  }

  isAdminAccount.value = access.isAdmin
  authReady.value = true
  authAccessState.value = 'ready'
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
}

onMounted(() => {
  window.addEventListener('pageshow', handlePageShow)
  void reconcileStripeBack()

  if (isGenerating.value) {
    startPolling()
    slowGenerationTimer = setTimeout(() => {
      if (isGenerating.value) slowGeneration.value = true
    }, 45_000)
  }

  void verifyPublishingAccess()
})

onBeforeUnmount(() => {
  window.removeEventListener('pageshow', handlePageShow)
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
const invalidFieldClass = 'border-release-warning focus-visible:ring-release-focus/60'

const checkoutPending = ref(false)
const checkoutError = ref<string | null>(null)
const adminPublishPending = ref(false)
const adminPublishError = ref<string | null>(null)

// Payment is blocked only by things that genuinely prevent checkout. A missing
// or failed screenshot never blocks it — the API decides whether the remaining
// data can be published, and the screenshot can be recaptured afterwards.
const canPay = computed(() =>
  authReady.value
  && publishingMode.value.kind === 'checkout'
  && !isGenerating.value
  && !domainConflict.value
  && previewCopyError.value === null
  && emailLooksValid.value
  && !checkoutPending.value
  && checkoutCancellationState.value !== 'pending'
  && checkoutCancellationState.value !== 'error',
)

const canAdminPublish = computed(() =>
  authReady.value
  && publishingMode.value.kind === 'admin'
  && !isGenerating.value
  && !domainConflict.value
  && previewCopyError.value === null
  && !adminPublishPending.value
  && checkoutCancellationState.value !== 'pending',
)

const publishAsAdmin = async () => {
  if (!canAdminPublish.value) return

  adminPublishPending.value = true
  adminPublishError.value = null

  try {
    if (publishingMode.value.cancelCheckout) {
      applyPreview(await cancelPreviewCheckout(token))
    }

    await updatePreview(token, { ...buildPreviewTextEdit(form), primary_category_id: primaryCategoryId.value })
    const listing = await publishAdminPreview(token, selectedTier.value)
    await navigateTo(`/admin/listings/${listing.id}`)
  }
  catch (error: unknown) {
    adminPublishError.value = toErrorLike(error).data?.message
      ?? 'This placement could not be published. Nothing was charged; try again or review it in Admin.'
  }
  finally {
    adminPublishPending.value = false
  }
}

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
    await updatePreview(token, { ...buildPreviewTextEdit(form), primary_category_id: primaryCategoryId.value })

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
    track('Checkout Started')
    markCheckoutRedirect(checkoutReturnStorage(), token)
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
  <div class="mx-auto max-w-[90rem] px-5 py-10 sm:px-6 lg:py-14">
    <!-- Not found / expired -->
    <div v-if="error || !preview" class="py-16 text-center">
      <h1 class="text-3xl font-bold text-release-paper">
        Preview not found
      </h1>
      <p class="mx-auto mt-3 max-w-md text-release-paper-muted">
        This preview may have expired (previews last 7 days) or the link is invalid.
      </p>
      <NuxtLink to="/" class="mt-6 inline-block text-release-warning underline">
        Start a new preview
      </NuxtLink>
    </div>

    <template v-else>
      <header class="flex flex-col gap-5 border-b border-release-seam pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div class="max-w-2xl">
          <p class="font-mono text-[0.65rem] font-semibold tracking-[0.2em] text-release-warning uppercase">
            Private release · {{ preview.domain }}
          </p>
          <h1 class="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#f6f1e7] lg:text-4xl">
            Review the release record
          </h1>
          <p class="mt-2 text-release-paper-muted">
            {{ !authReady
              ? 'Review the captured evidence while we check your publishing access.'
              : isAdminAccount
                ? 'Verify the evidence, choose its catalog placement, and publish directly.'
                : 'Verify the evidence, choose a catalog placement, and publish only when it is ready.' }}
          </p>
        </div>
        <NuxtLink
          to="/"
          class="inline-flex h-10 items-center justify-center border border-release-seam px-4 font-mono text-xs font-semibold tracking-[0.08em] text-release-paper-muted uppercase transition-colors hover:border-release-paper-muted hover:text-release-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-warning"
        >
          Start over
        </NuxtLink>
      </header>

      <IntakePreviewStatus
        v-if="isGenerating"
        class="mt-6"
        :status="preview.status"
        :has-screenshot="hasScreenshot"
        :slow="slowGeneration"
        :domain="preview.domain"
      />

      <!-- Keep the real product visible while enrichment runs. The buyer can
           understand the placement and plans instead of staring at a fake page. -->
      <div class="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,20rem)_15rem] xl:items-start xl:gap-6">
        <!-- LEFT: compact proof and editable listing details in normal document flow. -->
        <div class="min-w-0">
          <IntakePlacementPreview
            class="min-w-0"
            :preview="preview"
            :tier="selectedTier"
            :title="form.title"
            :tagline="form.tagline"
            :generating="isGenerating"
          />

          <IntakePreviewEditor
            v-if="!domainConflict && !isGenerating"
            v-model:title="form.title"
            v-model:tagline="form.tagline"
            v-model:description="form.description"
            v-model:open="showEdit"
            :domain="preview.domain"
            :has-screenshot="hasScreenshot"
            :recapturing="recapturing"
            :recapture-error="recaptureError"
            @recapture="recapture"
          />

          <!-- Compact warning: the capture failed, publishing still works. -->
          <div
            v-if="!domainConflict && !isGenerating && (isFailed || !hasScreenshot)"
            class="mt-4 border border-release-warning/40 bg-release-warning/[0.07] p-4"
            role="status"
          >
            <p class="text-sm font-medium text-release-paper">
              <template v-if="screenshotFailed || !hasScreenshot">
                We couldn't capture a screenshot for this site.
              </template>
              <template v-else>
                We couldn't finish building this preview.
              </template>
            </p>
            <p class="mt-1 text-sm text-release-paper-muted">
              You can still publish your listing now — we'll show the placeholder until a capture succeeds,
              and you can retry the screenshot at any time.
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-4">
              <Button type="button" variant="outline" size="sm" :disabled="recapturing" @click="recapture">
                <AppSpinner v-if="recapturing" class="mr-2" color="text-current" label="Starting a new capture" />
                {{ recapturing ? 'Starting…' : 'Capture again' }}
              </Button>
              <NuxtLink to="/" class="text-sm text-release-warning underline underline-offset-4">
                Try another URL
              </NuxtLink>
            </div>
            <p v-if="recaptureError" class="mt-3 text-sm text-release-warning" role="alert">
              {{ recaptureError }}
            </p>
          </div>
        </div>

        <!-- RIGHT: package and identity stay in document flow. The compact
             payment docket is the only sticky surface at desktop widths. -->
        <div
          class="min-w-0 space-y-6"
          :class="domainConflict || authAccessState === 'unavailable' ? 'xl:col-span-2 xl:max-w-[32rem]' : ''"
        >
          <IntakeDuplicateReleaseNotice
            v-if="domainConflict && existingListing"
            :action="existingListing.action"
            :domain="existingListing.domain"
            :listing-path="existingListing.listing_path"
            :dashboard-path="existingListing.dashboard_path"
            :claim-path="claimPath"
          />

          <section
            v-else-if="authAccessState === 'unavailable'"
            class="border border-release-warning/45 bg-release-warning/[0.05] p-5"
            role="alert"
          >
            <p class="font-mono text-[0.65rem] font-semibold tracking-[0.18em] text-release-warning uppercase">
              Access check paused
            </p>
            <h2 class="mt-3 text-lg font-semibold text-release-paper">
              We couldn't verify your LaunchLog session
            </h2>
            <p class="mt-2 text-sm leading-6 text-release-paper-muted">
              Your preview is safe and nothing was charged or published. Check your connection, then retry the account check.
            </p>
            <Button type="button" variant="outline" class="mt-4" @click="verifyPublishingAccess">
              Retry access check
            </Button>
          </section>

          <template v-else-if="!domainConflict">
          <!-- 01 — Select package -->
          <section>
            <h2 class="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-release-paper-muted">
              {{ !authReady ? '01 — Checking access' : isAdminAccount ? '01 — Select admin placement' : '01 — Select package' }}
            </h2>
            <IntakePlanSelector
              v-if="authReady"
              v-model="selectedTier"
              :admin-mode="isAdminAccount"
              :disabled="checkoutPending || adminPublishPending || domainConflict || (!isAdminAccount && checkoutReserved) || checkoutCancellationState === 'pending'"
            />
            <div
              v-else
              class="flex min-h-24 items-center gap-3 border border-release-seam bg-release-rail px-4 py-3"
              aria-busy="true"
              aria-live="polite"
            >
              <AppSpinner class="shrink-0" label="Checking publishing access" />
              <p class="text-sm text-release-paper-muted">Checking publishing access…</p>
            </div>
            <p v-if="checkoutReserved && !isAdminAccount" class="mt-2 text-xs leading-5 text-release-paper-muted">
              This plan is locked to your saved Stripe checkout so returning cannot create a different order.
            </p>
          </section>

          <!-- 02 — Publishing identity -->
          <section class="space-y-4">
            <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-release-paper-muted">
              {{ isAdminAccount
                ? '02 — Admin publishing'
                : checkoutReserved
                  ? '02 — Saved checkout'
                  : isAuthenticatedBuyer
                    ? '02 — Publishing account'
                    : '02 — Where should we send your listing?' }}
            </h2>
            <ReleaseStateMarker
              v-if="checkoutCancellationState === 'done'"
              data-checkout-return-status
              state="success"
              label="Checkout cancelled"
              detail="Nothing was charged or published. The website is available again."
              live
            />
            <div
              v-if="checkoutReserved && !isAdminAccount"
              class="border border-release-warning/45 bg-release-warning/[0.05] px-4 py-4"
              role="status"
            >
              <p class="text-sm font-semibold text-release-paper">
                {{ checkoutCancellationState === 'pending'
                  ? 'Cancelling secure checkout…'
                  : checkoutCancellationState === 'error'
                    ? 'Checkout could not be cancelled'
                    : 'Your secure checkout is ready to resume' }}
              </p>
              <p class="mt-1 text-sm leading-6 text-release-paper-muted">
                <template v-if="checkoutCancellationState === 'pending'">
                  Confirming with Stripe and releasing this website now.
                </template>
                <template v-else-if="checkoutCancellationState === 'error'">
                  Stripe did not confirm the cancellation, so no reservation was removed. Try again safely.
                </template>
                <template v-else>
                  Continue with the same {{ selectedPlan.name }} plan for
                  <span class="font-medium text-release-paper">{{ account.email }}</span>.
                </template>
              </p>
              <Button
                v-if="checkoutCancellationState === 'error'"
                type="button"
                variant="outline"
                size="sm"
                class="mt-3"
                @click="reconcileStripeBack"
              >Try cancellation again</Button>
            </div>
            <div
              v-else-if="!authReady"
              class="flex min-h-20 items-center gap-3 border border-release-seam bg-release-rail px-4 py-3"
              aria-busy="true"
              aria-live="polite"
            >
              <AppSpinner class="shrink-0" label="Checking your LaunchLog account" />
              <p class="text-sm text-release-paper-muted">
                Checking your LaunchLog account…
              </p>
            </div>
            <div
              v-else-if="isAuthenticatedBuyer"
              class="flex items-start gap-3 border border-release-seam bg-release-rail px-4 py-3.5"
            >
              <CheckCircle2 class="mt-0.5 size-5 shrink-0 text-release-signal" aria-hidden="true" />
              <div class="min-w-0">
                <p class="text-xs font-medium uppercase tracking-[0.14em] text-release-paper-muted">
                  {{ isAdminAccount ? 'Admin publishing' : 'Publishing as' }}
                </p>
                <p class="mt-1 break-words text-sm font-semibold text-release-paper">
                  {{ authenticatedEmail }}
                </p>
                <p class="mt-1 text-xs leading-5 text-release-paper-muted">
                  {{ isAdminAccount
                    ? 'This placement will be published directly without Stripe or a subscription.'
                    : 'This listing will be added directly to your signed-in account.' }}
                </p>
              </div>
            </div>
            <div v-else class="space-y-1.5">
              <div class="flex min-h-5 items-center justify-between gap-3">
                <Label for="a-email">Email address</Label>
                <span
                  class="text-right text-[11px] font-medium"
                  :class="emailShowsInvalid ? 'text-release-warning' : 'text-release-paper-muted'"
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
                :class="emailShowsInvalid ? 'text-release-warning' : 'text-release-paper-muted'"
                aria-live="polite"
              >
                {{ emailHelpText }}
              </p>
            </div>
          </section>

          </template>
        </div>

        <ReleaseActionRail
          v-if="!domainConflict && authAccessState !== 'unavailable'"
          data-payment-docket
          class="xl:sticky xl:top-6"
          step="03 — Publish"
          :title="isAdminAccount ? 'Admin docket' : 'Payment docket'"
          aria-label="Payment and publish controls"
        >
          <ReleaseStateMarker
            v-if="isAdminAccount"
            state="success"
            label="Admin placement"
            detail="No Stripe subscription."
          />
          <dl v-else class="border-y border-release-seam">
            <div class="py-3">
              <dt class="font-mono text-[0.65rem] font-semibold tracking-[0.14em] text-release-paper-muted uppercase">
                Total today
              </dt>
              <dd class="mt-2 text-2xl font-semibold tabular-nums text-release-paper">
                {{ selectedPlan.priceLabel }} <span class="text-xs font-normal text-release-paper-muted">/ year</span>
              </dd>
            </div>
          </dl>

          <template #footer>
            <Button
              v-if="isAdminAccount"
              size="lg"
              class="min-h-14 w-full whitespace-normal rounded-none border border-release-paper bg-release-paper px-3 text-release-ink hover:border-release-warning hover:bg-release-warning"
              :disabled="!canAdminPublish"
              @click="publishAsAdmin"
            >
              <AppSpinner v-if="adminPublishPending" class="mr-2" color="text-current" label="Publishing admin placement" />
              {{ adminPublishPending
                ? 'Publishing placement…'
                : checkoutCancellationState === 'pending'
                  ? 'Cancelling previous checkout…'
                  : isGenerating
                    ? 'Preparing preview…'
                    : `Publish ${selectedPlan.name}` }}
            </Button>
            <Button
              v-else
              size="lg"
              class="min-h-14 w-full whitespace-normal rounded-none border border-release-paper bg-release-paper px-3 text-release-ink hover:border-release-warning hover:bg-release-warning"
              :disabled="!canPay"
              @click="payAndPublish"
            >
              <AppSpinner v-if="checkoutPending" class="mr-2" color="text-current" label="Opening secure checkout" />
              {{ checkoutPending
                ? 'Opening secure checkout…'
                : checkoutCancellationState === 'pending'
                  ? 'Cancelling checkout…'
                  : checkoutCancellationState === 'error'
                    ? 'Retry cancellation'
                    : isGenerating
                      ? 'Preparing preview…'
                      : checkoutReserved
                        ? `Resume · ${selectedPlan.priceLabel}`
                        : `Pay ${selectedPlan.priceLabel} & publish` }}
            </Button>
            <div class="mt-3 min-h-5 text-center text-xs leading-5" aria-live="polite">
              <p v-if="previewCopyError || adminPublishError || checkoutError" class="text-release-warning" role="alert">
                {{ previewCopyError || adminPublishError || checkoutError }}
              </p>
              <p v-else-if="isGenerating" class="text-release-paper-muted">
                {{ isAdminAccount
                  ? 'Admin publishing unlocks automatically when the preview is ready.'
                  : 'Checkout unlocks automatically when the preview is ready.' }}
              </p>
              <p v-else-if="isAdminAccount" class="text-release-paper-muted">
                Direct placement · no checkout.
              </p>
              <p v-else class="text-release-paper-muted">
                Secure Stripe checkout · 7-day money-back guarantee.
              </p>
            </div>
          </template>
        </ReleaseActionRail>
      </div>
    </template>
  </div>
</template>
