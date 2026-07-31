<script setup lang="ts">
import type { PlanTier } from '~/composables/usePlans'

useSeoMeta({ title: 'Submit your product | LaunchLog' })

const route = useRoute()
const intake = useIntakeStore()

const isPlanTier = (value: unknown): value is PlanTier =>
  value === 'basic' || value === 'premium' || value === 'featured'

// Carry the plan picked on /pricing into the preview. Anything unknown or
// missing falls back to Featured, the default placement (D-058). Set before
// the form can generate a preview, so the choice reaches the new draft.
const requestedTier: PlanTier = isPlanTier(route.query.tier) ? route.query.tier : 'featured'
intake.setPreferredTier(requestedTier)

const { findPlan } = usePlans()
const selectedPlan = computed(() => findPlan(requestedTier))
</script>

<template>
  <main class="mx-auto max-w-3xl px-6 py-24">
    <h1 class="text-4xl font-bold text-brand-fg">
      Submit your product
    </h1>
    <p class="text-brand-muted mt-3">
      Drop your URL — we'll generate a free preview before you pay a cent.
    </p>
    <p class="mt-2 text-sm text-brand-muted">
      Starting with <span class="font-semibold text-brand-fg">{{ selectedPlan.name }}</span> — you can change the package on the preview.
    </p>
    <div class="mt-8">
      <IntakePreviewForm />
    </div>
  </main>
</template>
