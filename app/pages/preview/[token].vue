<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { ArrowLeft, ArrowRight, Check, CheckCircle2 } from '@lucide/vue'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
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

definePageMeta({ layout: 'preview' })

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
const showPublishing = ref(false)
const activePreview = ref('directory')
const publishingHeading = ref<HTMLElement | null>(null)
const entryPriceLabel = computed(() => checkoutReserved.value
  ? `${selectedPlan.value.name} · ${selectedPlan.value.priceLabel}/year`
  : `From ${findPlan('basic').priceLabel}/year`)

// A returning buyer must always see their reservation or cancellation recovery.
watch([checkoutReserved, checkoutCancellationState], ([reserved, cancellation]) => {
  if (reserved || cancellation !== 'idle') showPublishing.value = true
}, { immediate: true })

const revealPublishing = async () => {
  activePreview.value = 'directory'
  showPublishing.value = true
  await nextTick()
  publishingHeading.value?.focus({ preventScroll: true })
  publishingHeading.value?.scrollIntoView({ block: 'start' })
}

const closePublishing = async () => {
  showPublishing.value = false
  await nextTick()
  document.getElementById('preview-publish-toggle')?.focus({ preventScroll: true })
  window.scrollTo({ top: 0 })
}

const status = computed(() => preview.value?.status)
const isGenerating = computed(() => status.value === 'generating')
const isFailed = computed(() => status.value === 'failed')
const domainConflict = computed(() => isFailed.value && preview.value?.error_code === 'domain_conflict')
const publishingVisible = computed(() => showPublishing.value && !domainConflict.value && authAccessState.value !== 'unavailable')
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
  <div class="mx-auto max-w-[84rem] px-5 pt-10 pb-16 sm:px-8 lg:px-12 lg:pt-14 lg:pb-24">
    <div v-if="error || !preview" class="py-16 text-center">
      <h1 class="text-3xl font-semibold tracking-[-0.03em] text-release-paper">Preview not found</h1>
      <p class="mx-auto mt-3 max-w-md leading-7 text-release-paper-muted">
        This preview may have expired or the link is invalid.
      </p>
      <NuxtLink to="/" class="release-action mt-6">Start a new preview</NuxtLink>
    </div>

    <template v-else>
      <IntakePreviewStatus
        v-if="isGenerating"
        class="mb-8"
        :status="preview.status"
        :has-screenshot="hasScreenshot"
        :slow="slowGeneration"
        :domain="preview.domain"
      />

      <IntakeDuplicateReleaseNotice
        v-if="domainConflict && existingListing"
        class="mb-8"
        :action="existingListing.action"
        :domain="existingListing.domain"
        :listing-path="existingListing.listing_path"
        :dashboard-path="existingListing.dashboard_path"
        :claim-path="claimPath"
      />

      <section
        v-if="authAccessState === 'unavailable' && !domainConflict"
        class="mb-8 border border-release-warning/45 bg-release-warning/[0.05] p-5"
        role="alert"
      >
        <h2 class="text-lg font-semibold text-release-paper">We couldn't verify your LaunchLog session</h2>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-release-paper-muted">
          Your preview is safe and nothing was charged or published. Check your connection, then retry the account check.
        </p>
        <Button type="button" variant="outline" class="mt-4" @click="verifyPublishingAccess">Retry access check</Button>
      </section>

      <p v-if="previewCopyError && !domainConflict && !isGenerating" class="mb-6 text-sm leading-6 text-release-warning" role="alert">
        {{ previewCopyError }}
        <a href="#preview-editor-toggle" class="ml-2 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus">Review listing details</a>
      </p>

      <IntakePreviewShowcase
        v-if="!publishingVisible"
        :title="form.title"
        :tagline="form.tagline"
        :description="form.description"
        :domain="preview.domain"
        :url="preview.url"
        :screenshot-url="preview.screenshot_url"
        :generating="isGenerating"
      >
        <template #action>
          <div v-if="!domainConflict && authAccessState !== 'unavailable'" class="flex flex-wrap items-center gap-x-5 gap-y-3 md:max-w-64 md:flex-col md:items-stretch">
            <Button
              id="preview-publish-toggle"
              data-preview-publish-toggle
              type="button"
              size="lg"
              class="min-h-12 rounded-none border border-release-paper bg-release-paper px-6 text-release-ink hover:border-release-warning hover:bg-release-warning"
              :disabled="isGenerating"
              :aria-expanded="showPublishing"
              aria-controls="preview-publishing"
              @click="revealPublishing"
            >
              {{ isGenerating ? 'Preparing your page…' : checkoutReserved && !isAdminAccount ? 'Resume checkout' : 'Choose placement' }}
              <ArrowRight v-if="!isGenerating" class="size-4 shrink-0" aria-hidden="true" />
            </Button>
            <p class="text-xs leading-5 text-release-paper-muted md:text-center">
              {{ isAdminAccount ? 'Admin placement · no checkout' : entryPriceLabel }}
            </p>
          </div>
        </template>
      </IntakePreviewShowcase>

      <section
        v-show="publishingVisible"
        id="preview-publishing"
        data-preview-publishing
        data-preview-workspace
        aria-labelledby="preview-publishing-title"
      >
        <header class="mb-8 border-b border-release-seam pb-7 sm:mb-10">
          <button
            type="button"
            class="mb-6 inline-flex min-h-10 items-center gap-2 text-sm text-release-paper-muted underline-offset-4 hover:text-release-paper hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus"
            @click="closePublishing"
          >
            <ArrowLeft class="size-4" aria-hidden="true" />
            Back to full preview
          </button>
          <h1 v-if="publishingVisible" id="preview-publishing-title" ref="publishingHeading" tabindex="-1" class="scroll-mt-6 break-words text-3xl font-semibold tracking-[-0.035em] text-release-paper focus:outline-none sm:text-4xl">
            {{ form.title || preview.domain }}
          </h1>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-release-paper-muted sm:text-base">
            Your product page is included with both plans. Choose how it appears in the directory.
          </p>
        </header>

        <div class="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_20rem] xl:grid-rows-[auto_1fr] xl:gap-x-8 xl:gap-y-7">
          <section data-preview-plan-choice class="min-w-0 xl:col-start-2 xl:row-start-1" aria-labelledby="preview-plan-choice-title">
            <h2 id="preview-plan-choice-title" class="mb-3 text-lg font-semibold tracking-[-0.02em] text-release-paper">
              {{ !authReady ? 'Checking access' : checkoutReserved && !isAdminAccount ? 'Your saved placement' : 'Choose placement' }}
            </h2>
            <IntakePlanSelector
              v-if="authReady"
              v-model="selectedTier"
              compact
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
            <p class="mt-3 text-xs leading-5 text-release-paper-muted">
              {{ checkoutReserved && !isAdminAccount
                ? 'This plan is locked to your saved Stripe checkout so returning cannot create a different order.'
                : 'Switch plans to compare your placement in the directory preview.' }}
            </p>
          </section>

          <TabsRoot v-if="publishingVisible" v-model="activePreview" data-preview-tabs :unmount-on-hide="false" class="min-w-0 xl:col-start-1 xl:row-start-1 xl:row-span-2">
            <TabsList class="mb-6 flex gap-1 border-b border-release-seam" aria-label="Preview views">
              <TabsTrigger data-preview-tab="product" value="product" class="preview-view-tab">
                Product page
              </TabsTrigger>
              <TabsTrigger data-preview-tab="directory" value="directory" class="preview-view-tab">
                Directory placement
              </TabsTrigger>
            </TabsList>
            <TabsContent data-preview-panel="product" value="product" class="preview-view-panel">
              <IntakePreviewShowcase
                compact
                heading-level="h2"
                id-prefix="workspace-product"
                :title="form.title"
                :tagline="form.tagline"
                :description="form.description"
                :domain="preview.domain"
                :url="preview.url"
                :screenshot-url="preview.screenshot_url"
                :generating="isGenerating"
              />
            </TabsContent>
            <TabsContent data-preview-panel="directory" value="directory" class="preview-view-panel">
              <IntakePlacementPreview
                :preview="preview"
                :tier="selectedTier"
                :title="form.title"
                :tagline="form.tagline"
                :generating="isGenerating"
                :screenshot-failed="!isGenerating && (screenshotFailed || !hasScreenshot)"
                :recapturing="recapturing"
                @recapture="recapture"
              />
            </TabsContent>
          </TabsRoot>

          <div data-preview-publishing-details class="min-w-0 space-y-7 xl:col-start-2 xl:row-start-2">
            <section class="border-t border-release-seam pt-6" aria-labelledby="preview-plan-details-title">
              <h2 id="preview-plan-details-title" class="text-lg font-semibold tracking-[-0.02em] text-release-paper">
                {{ selectedPlan.name }} includes
              </h2>
              <ul class="mt-3 space-y-3 text-sm leading-6 text-release-paper-muted">
                <li v-for="feature in selectedPlan.features" :key="feature" class="flex items-start gap-2.5">
                  <Check class="mt-1 size-3.5 shrink-0" :stroke-width="2.5" aria-hidden="true" />
                  <span>{{ feature }}</span>
                </li>
              </ul>
            </section>
            <!-- The existing identity and reservation controls stay in the same flow. -->
            <section class="space-y-4">
              <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-release-paper-muted">
                {{ isAdminAccount
                  ? 'Admin publishing'
                  : checkoutReserved
                    ? 'Saved checkout'
                    : isAuthenticatedBuyer
                      ? 'Publishing account'
                      : 'Where should we send your listing?' }}
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
                v-if="(checkoutReserved && !isAdminAccount) || checkoutCancellationState === 'pending' || checkoutCancellationState === 'error'"
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

          <ReleaseActionRail
            data-payment-docket
            :title="isAdminAccount ? 'Publish your placement' : 'Your listing, ready to publish'"
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
        </div>
      </section>

      <div v-if="!domainConflict && !isGenerating" class="mt-8 sm:mt-12">
        <IntakePreviewEditor
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

        <div
          v-if="isFailed || !hasScreenshot"
          class="mt-5 border border-release-warning/40 bg-release-warning/[0.07] p-5"
          role="status"
        >
          <p class="text-sm font-medium text-release-paper">
            {{ screenshotFailed || !hasScreenshot ? "We couldn't capture a screenshot for this site." : "We couldn't finish building this preview." }}
          </p>
          <p class="mt-1 max-w-2xl text-sm leading-6 text-release-paper-muted">
            You can still publish your listing. A placeholder will appear until a capture succeeds, and you can retry at any time.
          </p>
          <div class="mt-3 flex flex-wrap items-center gap-4">
            <Button type="button" variant="outline" size="sm" :disabled="recapturing" @click="recapture">
              <AppSpinner v-if="recapturing" class="mr-2" color="text-current" label="Starting a new capture" />
              {{ recapturing ? 'Starting…' : 'Capture again' }}
            </Button>
            <NuxtLink to="/" class="text-sm text-release-warning underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus">Try another URL</NuxtLink>
          </div>
          <p v-if="recaptureError" class="mt-3 text-sm text-release-warning" role="alert">{{ recaptureError }}</p>
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.preview-view-tab {
  position: relative;
  min-height: 3rem;
  padding: 0.75rem 1rem;
  color: var(--release-paper-muted);
  font-size: 0.875rem;
  font-weight: 600;
  text-align: center;
  transition: color 150ms ease, background-color 150ms ease;
}

.preview-view-tab:hover {
  color: var(--release-paper);
  background: var(--release-rail);
}

.preview-view-tab[data-state='active'] {
  color: var(--release-paper);
}

.preview-view-tab[data-state='active']::after {
  position: absolute;
  right: 1rem;
  bottom: -1px;
  left: 1rem;
  height: 2px;
  background: var(--release-blaze);
  content: '';
}

.preview-view-tab:focus-visible,
.preview-view-panel:focus-visible {
  outline: 2px solid var(--release-focus);
  outline-offset: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .preview-view-tab {
    transition: none;
  }
}
</style>
