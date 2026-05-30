<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const route = useRoute()
const { getPreview } = usePreviews()
const { plans, findPlan } = usePlans()
const intake = useIntakeStore()

const token = typeof route.query.preview === 'string' ? route.query.preview : null

useSeoMeta({
  title: 'Complete your order | LaunchLog',
  robots: 'noindex, nofollow',
})

const selectedTier = ref(
  typeof route.query.tier === 'string' && plans.some(p => p.tier === route.query.tier)
    ? route.query.tier
    : token
      ? intake.getDraft(token)?.tier ?? 'featured'
      : 'featured',
)
const selectedPlan = computed(() => findPlan(selectedTier.value))

const { data: preview } = await useAsyncData(
  `checkout-${token ?? 'none'}`,
  () => (token ? getPreview(token) : Promise.resolve(null)),
)
if (preview.value) {
  intake.rememberPreview(preview.value)
}

// Publishing requires a ready preview with a captured screenshot (D-034).
const canPublish = computed(() =>
  preview.value?.status === 'ready' && !!preview.value?.screenshot_url,
)

const email = ref('')
watchEffect(() => {
  const stored = token ? intake.getDraft(token)?.email : null
  if (!email.value) email.value = stored || preview.value?.email || ''
})
const coupon = ref('')
const payNotice = ref(false)
</script>

<template>
  <main class="mx-auto max-w-5xl px-6 py-12">
    <NuxtLink to="/" class="text-xs uppercase tracking-[0.2em] text-brand-muted hover:text-brand-fg">
      ← Back to LaunchLog
    </NuxtLink>
    <h1 class="mt-3 text-3xl font-bold text-brand-fg lg:text-4xl">
      Complete your order
    </h1>
    <p class="mt-1.5 text-brand-muted">
      Add your product to the curated directory.
    </p>

    <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
      <section class="space-y-6">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
            01 — Account
          </p>
          <div class="mt-3 space-y-3">
            <div class="space-y-1.5">
              <label for="c-email" class="text-sm text-brand-fg">Email</label>
              <Input id="c-email" v-model="email" type="email" placeholder="you@yourproduct.com" />
              <p class="text-xs text-brand-muted">
                Your account is created automatically after checkout — no signup before you pay.
              </p>
            </div>
            <div class="flex items-end gap-2">
              <div class="flex-1 space-y-1.5">
                <label for="c-coupon" class="text-sm text-brand-fg">Coupon <span class="text-brand-muted">(optional)</span></label>
                <Input id="c-coupon" v-model="coupon" placeholder="LAUNCH-XXXX" />
              </div>
              <Button variant="outline" type="button" :disabled="!coupon" @click="payNotice = true">
                Apply
              </Button>
            </div>
          </div>
        </div>

        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
            02 — Selected placement
          </p>
          <div class="mt-3 rounded-xl border border-brand-border p-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <p class="font-semibold text-brand-fg">{{ selectedPlan.name }}</p>
                  <span
                    v-if="selectedPlan.badge"
                    class="rounded-full bg-brand-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-accent"
                  >
                    {{ selectedPlan.badge }}
                  </span>
                </div>
                <p class="mt-1 text-sm text-brand-muted">
                  Chosen on the preview screen. Change it there if needed.
                </p>
              </div>
              <div class="text-right">
                <p class="font-semibold text-brand-fg">
                  <span v-if="selectedPlan.compareAtLabel" class="mr-1 text-sm font-normal text-brand-muted line-through">{{ selectedPlan.compareAtLabel }}</span>{{ selectedPlan.priceLabel }}/year
                </p>
                <p class="text-xs text-brand-muted">{{ selectedPlan.monthlyLabel }}/month</p>
              </div>
            </div>
            <NuxtLink
              v-if="token"
              :to="`/preview/${token}`"
              class="mt-4 inline-flex text-sm text-brand-accent underline underline-offset-4"
            >
              ← Edit preview or change plan
            </NuxtLink>
          </div>
        </div>
      </section>

      <aside>
        <Card class="lg:sticky lg:top-8">
          <CardContent class="space-y-4 pt-6">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
              Order summary
            </p>

            <div v-if="preview" class="space-y-3">
              <div
                v-if="preview.screenshot_url"
                class="aspect-video w-full overflow-hidden rounded-md bg-muted ring-1 ring-white/10"
              >
                <img :src="preview.screenshot_url" :alt="preview.domain" class="h-full w-full object-cover object-top">
              </div>
              <p class="font-semibold text-brand-fg">{{ preview.title || preview.domain }}</p>
              <p class="truncate text-sm text-brand-accent">{{ preview.url }}</p>
            </div>
            <p v-else class="text-sm text-brand-warning">
              No preview attached. <NuxtLink to="/" class="underline">Start one</NuxtLink>.
            </p>

            <div class="space-y-1 border-t border-border pt-4">
              <div class="flex items-center justify-between">
                <span class="text-brand-muted">{{ selectedPlan.name }} — yearly</span>
                <span class="font-semibold text-brand-fg">
                  <span v-if="selectedPlan.compareAtLabel" class="mr-1 text-sm font-normal text-brand-muted line-through">{{ selectedPlan.compareAtLabel }}</span>{{ selectedPlan.priceLabel }}
                </span>
              </div>
              <p class="text-right text-xs text-brand-muted">
                That's just {{ selectedPlan.monthlyLabel }}/month
              </p>
            </div>

            <Button size="lg" class="w-full" :disabled="!canPublish" @click="payNotice = true">
              Pay &amp; publish — {{ selectedPlan.priceLabel }}
            </Button>

            <div class="min-h-10 text-center" aria-live="polite">
              <p v-if="preview && !canPublish" class="text-sm text-brand-warning" role="alert">
                Screenshot is required before publishing. Try again shortly or contact support.
              </p>
              <p v-else-if="payNotice" class="text-sm text-brand-warning" role="alert">
                Payment is wired up in Phase 2 (Stripe). The intake + preview flow is live now.
              </p>
            </div>
            <p class="text-center text-xs text-brand-muted">
              7-day money-back guarantee · Secure checkout
            </p>
          </CardContent>
        </Card>
      </aside>
    </div>
  </main>
</template>
