<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { CheckCircle2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CheckoutLegalConsent from '@/components/Intake/CheckoutLegalConsent.vue'
import type { PlanTier } from '~/composables/usePlans'
import type { Preview } from '~/composables/usePreviews'
import type { AiEnrichmentField, PreviewAiSuggestion } from '~/composables/useAiEnrichment'
import type { CheckoutLegalLocale } from '~/utils/checkout-capability'
import { toErrorLike } from '~/utils/error-like'
import { resolveCheckoutEmail } from '~/utils/checkout-customer'
import {
  clearCheckoutReturnMarker,
  hasCheckoutReturnMarker,
  markCheckoutRedirect,
  reconcileCancelledCheckout,
} from '~/utils/checkout-cancellation'
import { buildPreviewTextEdit, resolvePreviewCheckout } from '~/utils/preview-checkout'
import { resolvePreviewPublishingMode } from '~/utils/preview-publishing'
import { previewEditFromSuggestion } from '~/utils/ai-enrichment-review'
import { resolvePreviewAuthAccess } from '~/utils/preview-auth-access'

const route = useRoute()
const router = useRouter()
const token = route.params.token as string
const { getPreview, updatePreview, recapturePreview, cancelPreviewCheckout } = usePreviews()
const { createSession, getCheckoutCapability } = useBilling()
const { user, waitForAuthReady, isAdmin: resolveIsAdmin } = useAuth()
const { publishPreview: publishAdminPreview } = useAdminListings()
const { findPlan } = usePlans()
const { suggestPreview } = useAiEnrichment()
const intake = useIntakeStore()

// Private artifact — must never be indexed (D-057).
useSeoMeta({
  title: 'Your listing preview | LaunchLog',
  robots: 'noindex, nofollow',
})

const { data: preview, error } = await useAsyncData(`preview-${token}`, () => getPreview(token))
const {
  data: checkoutCapability,
  error: checkoutCapabilityError,
  status: checkoutCapabilityStatus,
  refresh: refreshCheckoutCapability,
} = await useAsyncData('checkout-capability', () => getCheckoutCapability())
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
const aiSuggestion = ref<PreviewAiSuggestion | null>(null)
const aiBusy = ref(false)
const aiError = ref<string | null>(null)

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
const legalLocale = ref<CheckoutLegalLocale>('en')
const checkoutOffer = computed(() => checkoutCapability.value?.offers[selectedTier.value] ?? null)
const checkoutTerms = computed(() => checkoutCapability.value?.legal.locales[legalLocale.value] ?? null)
const alternateCheckoutTerms = computed(() => checkoutCapability.value?.legal.locales[legalLocale.value === 'en' ? 'ro' : 'en'] ?? null)
const checkoutNotices = computed(() => checkoutOffer.value?.notices[legalLocale.value] ?? null)
const checkoutProvider = computed(() => checkoutCapability.value?.provider ?? null)
const checkoutProviderDetails = computed(() => checkoutProvider.value
  ? [
      `Registered office: ${checkoutProvider.value.legal_address}`,
      `Trade Register: ${checkoutProvider.value.registration_id}`,
      `Tax ID: ${checkoutProvider.value.tax_id}`,
      `Share capital: ${checkoutProvider.value.share_capital}`,
      `Telephone: ${checkoutProvider.value.phone}`,
      `Email: ${checkoutProvider.value.email}`,
    ]
  : [])
const orderPrice = computed(() => checkoutOffer.value
  ? new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: checkoutOffer.value.currency,
      currencyDisplay: 'code',
    }).format(checkoutOffer.value.amount_minor / 100)
  : 'Price unavailable')
const checkoutOfferMatchesPublicPlan = computed(() => !!checkoutOffer.value
  && checkoutOffer.value.tier === selectedPlan.value.tier
  && checkoutOffer.value.name === selectedPlan.value.name
  && checkoutOffer.value.amount_minor === selectedPlan.value.annualPriceCents
  && checkoutOffer.value.currency === selectedPlan.value.currency
  && checkoutOffer.value.interval === 'year'
  && checkoutOffer.value.interval_count === 1
  && checkoutOffer.value.quantity === 1)
const checkoutLegalBlocker = computed(() => {
  if (checkoutCapabilityError.value) return 'Secure checkout information is temporarily unavailable. Nothing can be charged or published.'
  if (!checkoutCapability.value) return 'Loading the current provider, order and contract information…'
  if (!checkoutCapability.value.checkout_enabled) return 'Secure checkout is currently closed. Nothing can be charged or published.'
  if (!checkoutOfferMatchesPublicPlan.value) return 'The public plan and server order do not match. Checkout is blocked until the offer is corrected.'
  if (!checkoutTerms.value || !checkoutNotices.value) return 'The selected contract language is incomplete. Checkout remains blocked.'
  return null
})
const checkoutLegalReady = computed(() => checkoutLegalBlocker.value === null)
const termsAccepted = ref(false)
const immediatePerformanceRequested = ref(false)
const resetCheckoutLegalDecisions = () => {
  termsAccepted.value = false
  immediatePerformanceRequested.value = false
}

const completePreviewCreatedMeasurement = (current: Preview) => {
  if (intake.consumePreviewCreatedMeasurement(current)) track('Preview Created')
}
const retryCheckoutCapability = async () => {
  resetCheckoutLegalDecisions()
  checkoutError.value = null
  await refreshCheckoutCapability()
}
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
  completePreviewCreatedMeasurement(next)
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

const reconcileStripeBack = async (force = false) => {
  const returnedFromCheckout = force
    || route.query.checkout === 'cancelled'
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
    resetCheckoutLegalDecisions()
    checkoutError.value = null
    if (result.cancelled) track('Payment Canceled')
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
  if (preview.value) completePreviewCreatedMeasurement(preview.value)
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

const generateAiSuggestion = async () => {
  if (aiBusy.value) return
  aiBusy.value = true
  aiError.value = null
  try {
    aiSuggestion.value = await suggestPreview(token)
  }
  catch (e: unknown) {
    aiError.value = toErrorLike(e).data?.message ?? 'The AI draft could not be prepared. Your current preview is unchanged.'
  }
  finally {
    aiBusy.value = false
  }
}

const acceptAiSuggestion = async (fields: AiEnrichmentField[]) => {
  if (!aiSuggestion.value || aiBusy.value) return
  aiBusy.value = true
  aiError.value = null
  const next = previewEditFromSuggestion({
    title: form.title,
    tagline: form.tagline,
    description: form.description,
    primary_category_id: primaryCategoryId.value,
  }, aiSuggestion.value.proposed, fields)
  try {
    applyPreview(await updatePreview(token, {
      title: next.title || null,
      tagline: next.tagline || null,
      description: next.description || null,
      primary_category_id: next.primary_category_id,
    }))
    form.title = next.title
    form.tagline = next.tagline
    form.description = next.description
    primaryCategoryId.value = next.primary_category_id
    aiSuggestion.value = null
  }
  catch (e: unknown) {
    aiError.value = toErrorLike(e).data?.message ?? 'The selected suggestions could not be saved. Your current preview is unchanged.'
  }
  finally {
    aiBusy.value = false
  }
}

// Payment is blocked only by things that genuinely prevent checkout. A missing
// or failed screenshot never blocks it — the API decides whether the remaining
// data can be published, and the screenshot can be recaptured afterwards.
const paymentActionLocked = computed(() =>
  !authReady.value
  || publishingMode.value.kind !== 'checkout'
  || isGenerating.value
  || domainConflict.value
  || checkoutPending.value
  || checkoutCancellationState.value === 'pending'
  || checkoutCancellationState.value === 'error',
)

const canPay = computed(() =>
  !paymentActionLocked.value
  && emailLooksValid.value
  && checkoutLegalReady.value
  && termsAccepted.value
  && immediatePerformanceRequested.value,
)

const canAdminPublish = computed(() =>
  authReady.value
  && publishingMode.value.kind === 'admin'
  && !isGenerating.value
  && !domainConflict.value
  && !adminPublishPending.value
  && checkoutCancellationState.value !== 'pending',
)

const focusCheckoutBlocker = async () => {
  await nextTick()

  const targetId = !emailLooksValid.value
    ? 'a-email'
    : !checkoutLegalReady.value
      ? 'checkout-legal-config-alert'
      : !termsAccepted.value
        ? 'checkout-terms-accepted'
        : !immediatePerformanceRequested.value
          ? 'checkout-immediate-performance'
          : null

  if (targetId) document.getElementById(targetId)?.focus()
}

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
  if (!canPay.value) {
    await focusCheckoutBlocker()
    return
  }

  checkoutPending.value = true
  checkoutError.value = null
  // Pinned BEFORE the first await and reused by both calls: the plan and
  // address that reach Stripe are exactly the ones this click selected, even
  // if the selector or the field changes while the requests are in flight.
  const email = emailValue.value
  const tier = selectedTier.value
  const capability = checkoutCapability.value
  const terms = checkoutTerms.value
  let redirecting = false

  if (!capability || !terms) {
    await focusCheckoutBlocker()
    checkoutPending.value = false
    return
  }

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
      terms_accepted: termsAccepted.value,
      terms_version: capability.legal.terms_version,
      immediate_performance_requested: immediatePerformanceRequested.value,
      performance_notice_version: capability.legal.performance_notice_version,
      legal_locale: legalLocale.value,
      checkout_capability_version: capability.capability_version,
      checkout_capability_sha256: capability.capability_sha256,
      provider_sha256: capability.provider_sha256,
      offer_catalog_sha256: capability.offer_catalog_sha256,
      terms_document_sha256: terms.document_sha256,
    })

    redirecting = true
    if (session.created_new_session) track('Checkout Started')
    markCheckoutRedirect(checkoutReturnStorage(), token)
    window.location.href = session.url
  }
  catch (e: unknown) {
    const errorData = toErrorLike(e).data
    const errorCode = errorData?.error_code ?? errorData?.code ?? errorData?.error
    if (errorCode === 'checkout_capability_changed') {
      resetCheckoutLegalDecisions()
      await refreshCheckoutCapability()
      checkoutError.value = 'The provider, offer or contract information changed. Review the current details and make both decisions again; nothing has been charged or published.'
    }
    else {
      checkoutError.value = errorCode === 'checkout_agreement_changed'
        ? 'This saved checkout uses an older legal notice. Cancel the saved checkout and restart before continuing; nothing has been charged or published.'
        : checkoutReserved.value
          ? 'Your saved checkout could not be reopened. Cancel the saved checkout and restart, or contact support; nothing has been charged or published.'
          : (errorData?.message ?? 'We could not start checkout. Please try again.')
    }
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

watch(selectedTier, (tier, previousTier) => {
  if (tier !== previousTier && !checkoutReserved.value) resetCheckoutLegalDecisions()
})

watch(legalLocale, resetCheckoutLegalDecisions)

watch(() => checkoutCapability.value?.capability_sha256, (next, previous) => {
  if (previous && next !== previous) resetCheckoutLegalDecisions()
})
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

          <!-- Discreet listing-text editor — not a step; defaults come from the crawl -->
          <IntakePreviewEditor
            v-if="!domainConflict && !isGenerating"
            v-model:title="form.title"
            v-model:tagline="form.tagline"
            v-model:description="form.description"
            v-model:open="showEdit"
            :has-screenshot="hasScreenshot"
            :recapturing="recapturing"
            :recapture-error="recaptureError"
            :ai-busy="aiBusy"
            :ai-error="aiError"
            :ai-suggestion="aiSuggestion"
            @recapture="recapture"
            @improve="generateAiSuggestion"
            @apply="acceptAiSuggestion"
            @reject="aiSuggestion = null"
          />
        </div>

        <!-- RIGHT: order form (package + email) -->
        <div class="min-w-0 space-y-8">
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

          <template v-else>
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
            <div
              v-if="checkoutCancellationState === 'done'"
              class="flex items-start gap-3 border border-release-signal/35 bg-release-signal/[0.07] px-4 py-4"
              role="status"
            >
              <CheckCircle2 class="mt-0.5 size-5 shrink-0 text-release-signal" aria-hidden="true" />
              <div>
                <p class="text-sm font-semibold text-release-paper">Checkout cancelled</p>
                <p class="mt-1 text-sm leading-6 text-release-paper-muted">
                  Nothing was charged or published. This website is available again, so you can change the plan or retry.
                </p>
              </div>
            </div>
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
                v-if="checkoutCancellationState !== 'pending'"
                type="button"
                variant="outline"
                size="sm"
                class="mt-3"
                @click="reconcileStripeBack(true)"
              >{{ checkoutCancellationState === 'error' ? 'Try cancellation again' : 'Cancel saved checkout and restart' }}</Button>
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

          <section v-if="!isAdminAccount" class="space-y-4" aria-labelledby="checkout-order-heading">
            <div>
              <p class="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-release-blaze">03 — Review annual order</p>
              <h2 id="checkout-order-heading" class="mt-2 text-lg font-semibold text-release-paper">Your order before Stripe</h2>
            </div>

            <fieldset class="border border-release-seam p-4">
              <legend class="px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-release-paper-muted">Contract language</legend>
              <div class="mt-1 grid grid-cols-2 gap-2 sm:max-w-sm">
                <label
                  v-for="option in ([{ value: 'en', label: 'English' }, { value: 'ro', label: 'Română' }] as const)"
                  :key="option.value"
                  class="relative cursor-pointer"
                >
                  <input v-model="legalLocale" type="radio" name="checkout-legal-locale" :value="option.value" class="peer sr-only" :disabled="paymentActionLocked">
                  <span class="flex min-h-11 items-center justify-center border border-release-seam bg-release-ink px-3 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-release-paper-muted transition-colors peer-checked:border-release-blaze peer-checked:text-release-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-release-focus peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
                    {{ option.label }}
                  </span>
                </label>
              </div>
            </fieldset>

            <dl class="grid border-t border-l border-release-seam text-sm sm:grid-cols-2">
              <div class="border-r border-b border-release-seam p-4">
                <dt class="font-mono text-[10px] uppercase tracking-[0.12em] text-release-paper-muted">Service</dt>
                <dd class="mt-2 leading-6 text-release-paper">One {{ checkoutOffer?.name || selectedPlan.name }} LaunchLog directory listing for 12 months.</dd>
              </div>
              <div class="border-r border-b border-release-seam p-4">
                <dt class="font-mono text-[10px] uppercase tracking-[0.12em] text-release-paper-muted">Base annual price</dt>
                <dd class="mt-2 font-semibold text-release-paper">{{ orderPrice }}</dd>
              </div>
              <div class="border-r border-b border-release-seam p-4">
                <dt class="font-mono text-[10px] uppercase tracking-[0.12em] text-release-paper-muted">Annual renewal</dt>
                <dd :lang="legalLocale" class="mt-2 leading-6 text-release-paper">{{ checkoutNotices?.renewal || 'Current renewal information is unavailable.' }}</dd>
              </div>
              <div class="border-r border-b border-release-seam p-4">
                <dt class="font-mono text-[10px] uppercase tracking-[0.12em] text-release-paper-muted">Cancellation</dt>
                <dd :lang="legalLocale" class="mt-2 leading-6 text-release-paper">{{ checkoutNotices?.cancellation || 'Current cancellation information is unavailable.' }}</dd>
              </div>
              <div class="border-r border-b border-release-seam p-4">
                <dt class="font-mono text-[10px] uppercase tracking-[0.12em] text-release-paper-muted">Voluntary refund</dt>
                <dd :lang="legalLocale" class="mt-2 leading-6 text-release-paper">{{ checkoutNotices?.voluntary_refund || 'Current refund information is unavailable.' }}</dd>
              </div>
              <div class="border-r border-b border-release-seam p-4">
                <dt class="font-mono text-[10px] uppercase tracking-[0.12em] text-release-paper-muted">Contracting provider</dt>
                <dd class="mt-2 leading-6 text-release-paper">
                  <strong class="font-semibold">{{ checkoutProvider?.legal_name || 'Not configured — checkout remains blocked' }}</strong>
                  <ul v-if="checkoutProviderDetails.length" class="mt-2 space-y-1 text-xs leading-5 text-release-paper-muted">
                    <li v-for="detail in checkoutProviderDetails" :key="detail">{{ detail }}</li>
                  </ul>
                </dd>
              </div>
            </dl>

            <p v-if="checkoutNotices?.tax" data-tax-notice :lang="legalLocale" class="border-l-2 border-release-signal bg-release-rail px-4 py-3 text-xs leading-5 text-release-paper-muted">
              {{ checkoutNotices.tax }}
            </p>
            <p v-else class="border-l-2 border-release-warning bg-release-warning/[0.06] px-4 py-3 text-xs leading-5 text-release-warning" role="alert">
              Tax information is not configured. Checkout remains blocked until the accountant-approved notice is available.
            </p>

            <CheckoutLegalConsent
              v-if="checkoutTerms && alternateCheckoutTerms"
              v-model:terms-accepted="termsAccepted"
              v-model:immediate-performance-requested="immediatePerformanceRequested"
              :locale="legalLocale"
              :terms-url="checkoutTerms.url"
              :alternate-terms-url="alternateCheckoutTerms.url"
              :terms-document="checkoutTerms.document"
              :acceptance-text="checkoutTerms.acceptance_text"
              :performance-request-text="checkoutTerms.performance_request_text"
              :attempted="attemptedPublish"
              :disabled="paymentActionLocked"
            />

            <p class="text-xs leading-5 text-release-paper-muted">
              We retain a server-timestamped contract record and send the contract confirmation to your checkout email. Read the
              <NuxtLink to="/privacy" target="_blank" class="text-release-blaze underline underline-offset-4">Privacy Policy</NuxtLink>
              or use the permanent <NuxtLink to="/withdrawal" class="text-release-blaze underline underline-offset-4">withdrawal function</NuxtLink>.
            </p>

            <p v-if="checkoutLegalBlocker" id="checkout-legal-config-alert" tabindex="-1" class="text-sm leading-6 text-release-warning focus:outline-none" role="alert">
              {{ checkoutLegalBlocker }}
            </p>
            <Button
              v-if="checkoutCapabilityError"
              type="button"
              variant="outline"
              size="sm"
              :disabled="checkoutCapabilityStatus === 'pending'"
              aria-describedby="checkout-legal-config-alert"
              @click="retryCheckoutCapability"
            >
              <AppSpinner v-if="checkoutCapabilityStatus === 'pending'" class="mr-2" color="text-current" label="Reloading secure checkout information" />
              {{ checkoutCapabilityStatus === 'pending' ? 'Reloading checkout information…' : 'Retry checkout information' }}
            </Button>
          </section>

          <!-- CTA -->
          <section>
            <Button
              v-if="isAdminAccount"
              size="lg"
              class="w-full"
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
                    : `Publish ${selectedPlan.name} as admin` }}
            </Button>
            <Button v-else size="lg" class="w-full" :disabled="paymentActionLocked" @click="payAndPublish">
              <AppSpinner v-if="checkoutPending" class="mr-2" color="text-current" label="Opening secure checkout" />
              {{ checkoutPending
                ? 'Opening secure checkout…'
                : checkoutCancellationState === 'pending'
                  ? 'Cancelling checkout…'
                  : checkoutCancellationState === 'error'
                    ? 'Retry cancellation above'
                    : isGenerating
                      ? 'Preparing preview…'
                      : checkoutReserved
                        ? checkoutLegalReady ? `Resume secure payment — ${orderPrice}/year` : 'Secure checkout unavailable'
                        : checkoutLegalReady ? `Continue to secure payment — ${orderPrice}/year` : 'Secure checkout unavailable' }}
            </Button>
            <div class="mt-3 min-h-5 text-center text-xs" aria-live="polite">
              <p v-if="adminPublishError || checkoutError" class="text-release-warning" role="alert">
                {{ adminPublishError || checkoutError }}
              </p>
              <p v-else-if="isGenerating" class="text-release-paper-muted">
                {{ isAdminAccount
                  ? 'Admin publishing unlocks automatically when the preview is ready.'
                  : 'Checkout unlocks automatically when the preview is ready.' }}
              </p>
              <p v-else-if="isAdminAccount && !domainConflict" class="text-release-paper-muted">
                Manual admin placement · no checkout or subscription.
              </p>
              <p v-else-if="!domainConflict" :lang="checkoutNotices?.voluntary_refund ? legalLocale : undefined" class="text-release-paper-muted">
                {{ checkoutNotices?.voluntary_refund || 'No payment can start until the current checkout terms are available.' }}
              </p>
            </div>
          </section>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
