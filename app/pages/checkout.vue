<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const route = useRoute()
const { getPreview } = usePreviews()

const token = typeof route.query.preview === 'string' ? route.query.preview : null

useSeoMeta({
  title: 'Complete your order | LaunchLog',
  robots: 'noindex, nofollow',
})

// Pricing per D-058 (annual, USD). Stripe products are NOT live yet (Phase 2).
const plans = [
  {
    tier: 'basic',
    name: 'Basic',
    price: '$24.99',
    features: ['Listed in the directory', 'Website screenshot', 'Indexed in 24–48h', 'schema.org + llms.txt edge'],
  },
  {
    tier: 'premium',
    name: 'Premium',
    price: '$59.99',
    features: ['Everything in Basic', 'Homepage visibility', 'Priority placement', 'Featured in tech products'],
  },
  {
    tier: 'featured',
    name: 'Featured',
    price: '$149.99',
    features: ['Everything in Premium', 'Homepage featured section', 'Priority in search', 'Featured badge'],
  },
] as const

const selectedTier = ref(
  typeof route.query.tier === 'string' && plans.some(p => p.tier === route.query.tier)
    ? route.query.tier
    : 'basic',
)

const selectedPlan = computed(() => plans.find(p => p.tier === selectedTier.value) ?? plans[0])

const { data: preview } = await useAsyncData(
  `checkout-${token ?? 'none'}`,
  () => (token ? getPreview(token) : Promise.resolve(null)),
)

const payNotice = ref(false)
</script>

<template>
  <main class="mx-auto max-w-5xl px-6 py-16">
    <NuxtLink to="/" class="text-xs uppercase tracking-[0.2em] text-brand-muted hover:text-brand-fg">
      ← Back to LaunchLog
    </NuxtLink>
    <h1 class="mt-4 text-4xl font-bold text-brand-fg">
      Complete your order
    </h1>
    <p class="mt-2 text-brand-muted">
      Add your product to the curated directory.
    </p>

    <div class="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
      <section>
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
          01 — Select plan
        </p>
        <div class="mt-4 space-y-3">
          <button
            v-for="plan in plans"
            :key="plan.tier"
            type="button"
            class="w-full rounded-lg border p-5 text-left transition-colors"
            :class="selectedTier === plan.tier
              ? 'border-brand-accent bg-brand-accent/5'
              : 'border-border hover:border-brand-accent/50'"
            @click="selectedTier = plan.tier"
          >
            <div class="flex items-center justify-between">
              <span class="text-lg font-semibold text-brand-fg">{{ plan.name }}</span>
              <span class="text-lg font-semibold text-brand-fg">{{ plan.price }}<span class="text-sm text-brand-muted"> / year</span></span>
            </div>
            <ul class="mt-3 grid gap-1 text-sm text-brand-muted sm:grid-cols-2">
              <li v-for="f in plan.features" :key="f">✓ {{ f }}</li>
            </ul>
          </button>
        </div>

        <p class="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
          02 — Account
        </p>
        <p class="mt-3 rounded-lg border border-border p-4 text-sm text-brand-muted">
          An account will be created automatically with your email after checkout —
          use it to manage your listing. No signup needed before you pay.
        </p>
      </section>

      <aside>
        <Card class="sticky top-8">
          <CardContent class="space-y-4 pt-6">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
              Order summary
            </p>

            <div v-if="preview" class="space-y-2">
              <img
                v-if="preview.screenshot_url"
                :src="preview.screenshot_url"
                :alt="preview.domain"
                class="aspect-video w-full rounded-md object-cover"
              >
              <p class="font-semibold text-brand-fg">
                {{ preview.title || preview.domain }}
              </p>
              <p class="text-sm text-brand-accent">
                {{ preview.url }}
              </p>
            </div>
            <p v-else class="text-sm text-brand-warning">
              No preview attached. <NuxtLink to="/" class="underline">Start one</NuxtLink>.
            </p>

            <div class="flex items-center justify-between border-t border-border pt-4">
              <span class="text-brand-muted">{{ selectedPlan.name }} — billed annually</span>
              <span class="text-xl font-semibold text-brand-fg">{{ selectedPlan.price }}</span>
            </div>

            <Button
              size="lg"
              class="w-full"
              :disabled="!preview"
              @click="payNotice = true"
            >
              Pay &amp; publish — {{ selectedPlan.price }}
            </Button>

            <div class="min-h-10 text-center" aria-live="polite">
              <p v-if="payNotice" class="text-sm text-brand-warning" role="alert">
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
