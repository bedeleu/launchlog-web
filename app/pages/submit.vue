<script setup lang="ts">
import type { PlanTier } from '~/composables/usePlans'

useSeoMeta({ title: 'Submit your product | LaunchLog' })

const route = useRoute()
const intake = useIntakeStore()

const isPlanTier = (value: unknown): value is PlanTier =>
  value === 'basic' || value === 'featured'

// Carry the plan picked on /pricing into the preview. Anything unknown or
// missing falls back to Featured, the default placement (D-058). Set before
// the form can generate a preview, so the choice reaches the new draft.
const requestedTier: PlanTier = isPlanTier(route.query.tier) ? route.query.tier : 'featured'
intake.setPreferredTier(requestedTier)

const { findPlan } = usePlans()
const selectedPlan = computed(() => findPlan(requestedTier))
</script>

<template>
  <main class="min-h-screen py-8 lg:py-12">
    <ReleaseShell
      compact
      eyebrow="Private capture · step 01"
      title="Prepare your release"
      description="One URL starts the same private preview used on the homepage. Nothing is published or charged yet."
    >
      <div class="max-w-3xl border border-release-seam bg-release-rail p-5 sm:p-7">
        <p class="mb-6 font-mono text-[0.68rem] font-semibold tracking-[0.14em] text-release-warning uppercase">
          Starting placement · {{ selectedPlan.name }}
        </p>
        <IntakePreviewForm />
        <p class="mt-5 border-t border-release-seam pt-4 text-sm leading-6 text-release-paper-muted">
          You can change the placement after the website capture is ready.
        </p>
      </div>
    </ReleaseShell>
  </main>
</template>
