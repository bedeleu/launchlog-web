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

const draft = computed(() => intake.getDraft(token))

// Map a persisted draft to a Preview shape so back-nav paints instantly,
// before (or instead of) blocking on the network. Declared BEFORE useAsyncData.
const previewFromDraft = (): Preview | null => {
  const d = intake.getDraft(token)
  if (!d) return null
  return {
    token: d.token,
    status: d.status as Preview['status'],
    source_url: d.sourceUrl,
    url: d.url,
    domain: d.domain,
    title: d.title || null,
    tagline: d.tagline || null,
    description: d.description || null,
    primary_category_id: null,
    email: d.email || null,
    tier: d.tier,
    screenshot_url: d.screenshotUrl,
    crawl: null,
    error_code: null,
    error_message: null,
    expires_at: d.expiresAt,
  }
}

// Render the stored draft immediately; fetch in the background (SWR).
const seeded = previewFromDraft()
const { data: preview, error } = await useAsyncData(
  `preview-${token}`,
  () => getPreview(token),
  {
    lazy: !!seeded,
    default: () => seeded,
  },
)
if (preview.value) {
  intake.rememberPreview(preview.value)
}

const form = reactive({
  title: draft.value?.title ?? preview.value?.title ?? '',
  tagline: draft.value?.tagline ?? preview.value?.tagline ?? '',
  description: draft.value?.description ?? preview.value?.description ?? '',
  email: draft.value?.email ?? preview.value?.email ?? '',
})

// Featured is the default selection — it's the most valuable placement (D-058).
const selectedTier = ref(draft.value?.tier ?? 'featured')
const selectedPlan = computed(() => findPlan(selectedTier.value))

// Intake returns immediately with status=generating; crawl + screenshot run in a
// background job (D-057). Poll until the preview settles into ready/failed.
const isGenerating = computed(() => preview.value?.status === 'generating')
const screenshotFailed = computed(() =>
  preview.value?.status === 'failed' && preview.value?.error_code === 'screenshot_failed',
)
// Publishing requires a captured screenshot (D-034).
const canPublish = computed(() =>
  preview.value?.status === 'ready' && !!preview.value?.screenshot_url,
)

// Merge a freshly polled preview, filling editor fields the user hasn't touched.
const applyPreview = (next: Preview) => {
  preview.value = next
  intake.rememberPreview(next)
  if (!form.title && next.title) form.title = next.title
  if (!form.tagline && next.tagline) form.tagline = next.tagline
  if (!form.description && next.description) form.description = next.description
  if (!form.email && next.email) form.email = next.email
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

onMounted(() => {
  if (isGenerating.value) startPolling()
})

// Optimistic: persist edits in the background and navigate instantly — no blocking save.
const continueToCheckout = () => {
  if (!canPublish.value) return
  intake.updateDraft(token, {
    title: form.title,
    tagline: form.tagline,
    description: form.description,
    email: form.email,
    tier: selectedTier.value,
  })
  updatePreview(token, {
    title: form.title || null,
    tagline: form.tagline || null,
    description: form.description || null,
    email: form.email || null,
    tier: selectedTier.value,
  }).catch(() => {})
  navigateTo(`/checkout?preview=${token}&tier=${selectedTier.value}`)
}

watch(
  [() => form.title, () => form.tagline, () => form.description, () => form.email, selectedTier],
  () => {
    intake.updateDraft(token, {
      title: form.title,
      tagline: form.tagline,
      description: form.description,
      email: form.email,
      tier: selectedTier.value,
    })
  },
)
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-12 lg:py-16">
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
          <NuxtLink to="/" class="text-xs uppercase tracking-[0.2em] text-brand-muted hover:text-brand-fg">
            ← Back to website URL
          </NuxtLink>
          <h1 class="mt-4 text-3xl font-bold text-brand-fg lg:text-4xl">
            Review your listing
          </h1>
          <p class="mt-2 text-brand-muted">
            See how your product can appear before checkout. Preview is private. Pay only when you publish.
          </p>
        </div>
        <NuxtLink
          to="/"
          class="inline-flex h-10 items-center justify-center rounded-md border border-brand-border px-4 text-sm text-brand-muted transition-colors hover:border-brand-accent/50 hover:text-brand-fg"
        >
          Start over
        </NuxtLink>
      </header>

      <div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <!-- WOW placement preview (first on mobile) -->
        <IntakePlacementPreview
          class="min-w-0"
          :preview="preview"
          :tier="selectedTier"
          :title="form.title"
          :tagline="form.tagline"
          :generating="isGenerating"
        />

        <!-- Editor + plan + CTA (fixed sticky rail) -->
        <div class="min-w-0 space-y-7 lg:sticky lg:top-8">
          <section class="space-y-4">
            <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
              Your details
            </h2>
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
            <div class="space-y-1.5">
              <Label for="f-email">Email</Label>
              <Input id="f-email" v-model="form.email" type="email" placeholder="you@yourproduct.com" />
              <p class="text-xs text-brand-muted">
                We'll create your account with this email after checkout.
              </p>
            </div>
          </section>

          <section>
            <h2 class="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
              Choose your plan
            </h2>
            <IntakePlanSelector v-model="selectedTier" />
          </section>

          <section>
            <Button
              size="lg"
              class="w-full"
              :disabled="!canPublish"
              @click="continueToCheckout"
            >
              <template v-if="isGenerating">Generating your preview…</template>
              <template v-else>Continue with {{ selectedPlan.name }} — {{ selectedPlan.priceLabel }}/year</template>
            </Button>
            <div class="mt-3 min-h-5 text-center text-xs" aria-live="polite">
              <p v-if="screenshotFailed" class="text-brand-warning" role="alert">
                Screenshot is required before publishing. Try again shortly or contact support.
              </p>
              <p v-else-if="isGenerating" class="text-brand-muted">
                Building your preview — this takes a few seconds.
              </p>
              <p v-else-if="!canPublish" class="text-brand-warning" role="alert">
                We couldn't finish this preview. Try a different URL or contact support.
              </p>
              <p v-else class="text-brand-muted">
                Preview is private. Pay only when you publish · 7-day money-back guarantee.
              </p>
            </div>
          </section>
        </div>
      </div>
    </template>
  </main>
</template>
