<script setup lang="ts">
import { findPublicPlan, type PlanTier } from '#shared/constants/public-plans'
import type { ReferralSource } from '~/composables/usePreviews'

useSeoMeta({ title: 'Submit your product | LaunchLog' })

const route = useRoute()
const intake = useIntakeStore()

const EDITION_SLUG_PATTERN = /^\d{4}-w(?:0[1-9]|[1-4]\d|5[0-3])$/
const referralSource: ReferralSource = route.query.source === 'edition' ? 'edition' : 'direct'
const editionSlugParam = typeof route.query.edition_slug === 'string'
  ? route.query.edition_slug
  : undefined
const editionSlug = referralSource === 'edition'
  && editionSlugParam
  && EDITION_SLUG_PATTERN.test(editionSlugParam)
  ? editionSlugParam
  : undefined

const tier = typeof route.query.tier === 'string' ? route.query.tier : null
const requestedTier: PlanTier = findPublicPlan(tier).tier
intake.setPreferredTier(requestedTier)

const { findPlan } = usePlans()
const selectedPlan = computed(() => findPlan(requestedTier))
</script>

<template>
  <div class="min-h-screen py-8 lg:py-12">
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
        <IntakePreviewForm :source="referralSource" :edition-slug="editionSlug" />
        <p class="mt-5 border-t border-release-seam pt-4 text-sm leading-6 text-release-paper-muted">
          You can change the placement after the website capture is ready.
        </p>
      </div>
    </ReleaseShell>
  </div>
</template>
