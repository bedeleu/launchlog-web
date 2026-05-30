<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Preview } from '~/composables/usePreviews'

const route = useRoute()
const token = route.params.token as string
const { getPreview, updatePreview } = usePreviews()
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

// Account (02) — email + password, like BacklinkLog. Auto-generate is the default.
const account = reactive({
  email: draft.value?.email ?? preview.value?.email ?? '',
  password: '',
  autoGenerate: true,
})
const coupon = ref('')

// Featured is the default selection — the most valuable placement (D-058).
const selectedTier = ref(draft.value?.tier ?? 'featured')
const selectedPlan = computed(() => findPlan(selectedTier.value))

const status = computed(() => preview.value?.status)
const isGenerating = computed(() => status.value === 'generating')
const isReady = computed(() => status.value === 'ready' && !!preview.value?.screenshot_url)
const screenshotFailed = computed(() =>
  status.value === 'failed' && preview.value?.error_code === 'screenshot_failed',
)
const isFailed = computed(() => status.value === 'failed')

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

// Generate a secure password up-front (client-only) so the field is pre-filled
// and visible, like BacklinkLog. Toggling auto-generate regenerates / clears it.
const generatePassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*'
  const pick = (typeof window !== 'undefined' && window.crypto?.getRandomValues)
    ? () => {
        const a = new Uint32Array(1)
        window.crypto.getRandomValues(a)
        return a[0]!
      }
    : () => Math.floor(Math.random() * 0xFFFFFFFF)
  let out = ''
  for (let i = 0; i < 16; i++) out += chars[pick() % chars.length]
  return out
}

watch(() => account.autoGenerate, (on) => {
  account.password = on ? generatePassword() : ''
})

onMounted(() => {
  if (account.autoGenerate && !account.password) account.password = generatePassword()
  if (isGenerating.value) startPolling()
})

// Stripe checkout is Phase 2 — publishing is stubbed (D-057 conversion happens
// server-side on checkout.session.completed). Persist the draft so it's ready.
const emailValue = computed(() => account.email.trim())
const emailLooksValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue.value))
const attemptedPublish = ref(false)
const emailShowsInvalid = computed(() => attemptedPublish.value && !emailLooksValid.value)
const emailHelpText = computed(() => {
  if (!emailValue.value) return attemptedPublish.value ? 'Enter your email to activate checkout.' : 'Required for checkout.'
  if (!emailLooksValid.value) return attemptedPublish.value ? 'Enter a valid email address.' : 'We will validate this before checkout.'
  return 'We will create your account with this email after checkout.'
})
const passwordValue = computed(() => account.password.trim())
const passwordLooksValid = computed(() => account.autoGenerate || passwordValue.value.length >= 8)
const passwordShowsInvalid = computed(() => attemptedPublish.value && !passwordLooksValid.value)
const passwordHelpText = computed(() =>
  account.autoGenerate
    ? 'We generated a secure password — copy it, or uncheck to set your own.'
    : passwordLooksValid.value
      ? 'Custom password ready.'
      : 'Use at least 8 characters, or turn auto-generate back on.',
)
const invalidFieldClass = 'border-brand-warning/70 shadow-[0_0_0_1px_rgba(245,158,11,0.32),0_0_18px_rgba(245,158,11,0.14)] focus-visible:ring-brand-warning/25'
const canPay = computed(() =>
  isReady.value
  && emailLooksValid.value
  && passwordLooksValid.value
)
const publishRequested = ref(false)
const publish = () => {
  attemptedPublish.value = true
  if (!canPay.value) return
  updatePreview(token, {
    title: form.title || null,
    tagline: form.tagline || null,
    description: form.description || null,
    email: account.email || null,
    tier: selectedTier.value,
  }).catch(() => {})
  publishRequested.value = true
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
          <AppSpinner class="size-4 shrink-0" />
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
              <div class="h-10 animate-pulse rounded-md bg-white/[0.04]" />
            </div>
            <div class="h-11 animate-pulse rounded-md bg-white/[0.05]" />
          </div>
        </div>
      </div>

      <!-- FAILED: couldn't build the preview -->
      <section v-else-if="isFailed" class="mt-10 rounded-2xl border border-brand-border bg-white/[0.02] p-10 text-center">
        <h2 class="text-xl font-semibold text-brand-fg">
          We couldn't build this preview
        </h2>
        <p class="mx-auto mt-2 max-w-md text-sm text-brand-muted">
          <template v-if="screenshotFailed">
            We couldn't capture a screenshot for this site. Try a different URL, or check that the site is publicly reachable.
          </template>
          <template v-else>
            Something went wrong while building your preview. Try a different URL or contact support.
          </template>
        </p>
        <NuxtLink to="/" class="mt-6 inline-block text-brand-accent underline underline-offset-4">
          Try another URL
        </NuxtLink>
      </section>

      <!-- READY: BacklinkLog-style order page — live preview left, order form right -->
      <div v-else-if="isReady" class="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <!-- LEFT: the WOW live preview, sticky; plan switches are instant (v-show in the component) -->
        <div class="min-w-0 lg:sticky lg:top-8">
          <IntakePlacementPreview
            class="min-w-0"
            :preview="preview"
            :tier="selectedTier"
            :title="form.title"
            :tagline="form.tagline"
          />

          <!-- Discreet listing-text editor — not a step; defaults come from the crawl -->
          <div class="mt-4">
            <button
              type="button"
              class="text-xs font-medium text-brand-accent underline underline-offset-4"
              @click="showEdit = !showEdit"
            >
              {{ showEdit ? 'Done editing text' : 'Edit listing text' }}
            </button>
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

        <!-- RIGHT: order form (package + account) -->
        <div class="min-w-0 space-y-8">
          <!-- 01 — Select package -->
          <section>
            <h2 class="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
              01 — Select package
            </h2>
            <IntakePlanSelector v-model="selectedTier" />
          </section>

          <!-- 02 — Account -->
          <section class="space-y-4">
            <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
              02 — Account
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

            <label class="flex items-center gap-2.5 text-sm text-brand-fg">
              <input
                v-model="account.autoGenerate"
                type="checkbox"
                class="size-4 rounded border-brand-border bg-background accent-brand-accent"
              >
              Auto-generate a secure password
            </label>

            <!-- Always visible — no conditional mount, no layout shift. -->
            <div class="space-y-1.5">
              <div class="flex min-h-5 items-center justify-between gap-3">
                <Label for="a-password">Password</Label>
                <span
                  class="text-right text-[11px] font-medium"
                  :class="passwordShowsInvalid ? 'text-brand-warning' : 'text-brand-muted'"
                >
                  {{ passwordShowsInvalid ? 'Too short' : account.autoGenerate ? 'Generated' : 'Custom' }}
                </span>
              </div>
              <Input
                id="a-password"
                v-model="account.password"
                :type="account.autoGenerate ? 'text' : 'password'"
                :readonly="account.autoGenerate"
                :aria-invalid="passwordShowsInvalid"
                :class="[account.autoGenerate ? 'font-mono' : '', passwordShowsInvalid ? invalidFieldClass : '']"
                placeholder="Choose a password"
                autocomplete="new-password"
              />
              <p
                class="min-h-4 text-xs"
                :class="passwordShowsInvalid ? 'text-brand-warning' : 'text-brand-muted'"
                aria-live="polite"
              >
                {{ passwordHelpText }}
              </p>
            </div>

            <div class="space-y-1.5">
              <Label for="a-coupon">Coupon <span class="text-brand-muted">(optional)</span></Label>
              <Input id="a-coupon" v-model="coupon" placeholder="Have a code?" />
            </div>
          </section>

          <!-- CTA -->
          <section>
            <Button size="lg" class="w-full" :disabled="!canPay || publishRequested" @click="publish">
              Pay &amp; publish — {{ selectedPlan.priceLabel }}/year
            </Button>
            <div class="mt-3 min-h-5 text-center text-xs" aria-live="polite">
              <p v-if="publishRequested" class="text-brand-accent">
                Secure checkout (Stripe) lands in the next phase — your details are saved.
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
