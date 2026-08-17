<script setup lang="ts">
import { Sparkles } from '@lucide/vue'
import type { ListingCard, ListingTier } from '~/composables/useListings'
import type { ListingCardVariant } from '~/utils/listing-placement'

const props = withDefaults(defineProps<{
  listing: ListingCard
  variant?: ListingCardVariant
  generating?: boolean
  /**
   * Heading level for the listing name. Top-level directory pages go h1 -> card,
   * so they pass 'h2'; cards nested under a section heading keep the default.
   */
  headingLevel?: 'h2' | 'h3'
}>(), {
  variant: 'standard',
  generating: false,
  headingLevel: 'h3',
})

const tierMeta: Record<ListingTier, { label: string, classes: string }> = {
  featured: {
    label: 'Featured',
    classes: 'border-brand-accent/50 bg-brand-accent/15 text-brand-accent shadow-[0_0_24px_rgba(99,102,241,0.2)]',
  },
  premium: {
    label: 'Premium',
    classes: 'border-white/20 bg-white/[0.07] text-brand-fg',
  },
  basic: {
    label: 'Basic',
    classes: 'border-brand-border bg-black/10 text-brand-muted',
  },
}

const tier = computed(() => tierMeta[props.listing.tier] ?? tierMeta.basic)
/** Homepage editorial lead: horizontal from md, height driven by its content. */
const isSpotlight = computed(() => props.variant === 'spotlight')
/** Directory Featured: one row of a 30-slot page, so its desktop height is capped. */
const isDirectorySpotlight = computed(() => props.variant === 'directory-spotlight')
/** Either spotlight — both carry the Featured chrome and the wider content treatment. */
const isFeature = computed(() => isSpotlight.value || isDirectorySpotlight.value)
const isWide = computed(() => props.variant === 'wide')

const imageFailed = ref(false)
watch(() => props.listing.screenshot_url, () => {
  imageFailed.value = false
})
const showImage = computed(() => Boolean(props.listing.screenshot_url) && !imageFailed.value)

const cardClass = computed(() => {
  if (props.listing.tier === 'featured') {
    return 'border-brand-accent/55 bg-[linear-gradient(145deg,rgba(99,102,241,0.12),rgba(12,17,32,0.96)_58%)] shadow-[0_22px_60px_-34px_rgba(99,102,241,0.7)] ring-1 ring-brand-accent/15 group-hover:border-brand-accent/80 group-focus-visible:border-brand-accent/80'
  }

  if (props.listing.tier === 'premium') {
    return 'border-white/20 bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(12,17,32,0.94))] shadow-[0_18px_44px_-34px_rgba(255,255,255,0.38)] group-hover:border-brand-accent/55 group-focus-visible:border-brand-accent/55'
  }

  return 'border-brand-border bg-white/[0.02] group-hover:border-brand-accent/40 group-focus-visible:border-brand-accent/40'
})

const layoutClass = computed(() => {
  if (isSpotlight.value) return 'md:grid md:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.85fr)]'
  // Fixed 240/256px so a Featured row stays one row of the page instead of the
  // wall of hero cards the two-row version produced in production. It only goes
  // horizontal at lg, where the three-column directory grid exists.
  if (isDirectorySpotlight.value) return 'lg:grid lg:h-60 lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,0.9fr)] xl:h-64'
  // Two of three columns, stretched by h-full to whatever height its real basic
  // companion establishes in the same row.
  if (isWide.value) return 'flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
  return 'flex flex-col'
})

/** Below lg both directory cards stay ordinary stacked cards with a 16/10 shot. */
const mediaClass = computed(() => {
  if (isSpotlight.value) return 'md:aspect-auto md:min-h-64'
  if (isDirectorySpotlight.value || isWide.value) return 'lg:aspect-auto lg:h-full'
  return ''
})

const contentClass = computed(() => {
  if (isSpotlight.value) return 'gap-3 p-5 md:p-7'
  if (isDirectorySpotlight.value) return 'gap-2 p-5 lg:gap-2.5 lg:p-6'
  if (isWide.value) return 'gap-2.5 p-5'
  return 'gap-2 p-4'
})

const headingClass = computed(() => {
  if (isSpotlight.value) return 'line-clamp-2 text-xl md:text-2xl'
  if (isDirectorySpotlight.value) return 'line-clamp-2 text-xl'
  if (isWide.value) return 'line-clamp-2 text-lg'
  return 'truncate'
})

// Basic capabilities, surfaced wherever the card has room. They are deliberately
// not gated on tier: showing them only on Featured implies an exclusivity that
// pricing.vue and usePlans.ts do not sell.
const aiChips = computed(() => [
  props.listing.has_schema_org ? 'schema.org' : null,
  props.listing.has_llms_txt ? 'llms.txt' : null,
  props.listing.has_markdown_negotiation ? 'markdown' : null,
].filter((chip): chip is string => chip !== null))
</script>

<template>
  <article
    class="h-full min-w-0 overflow-hidden rounded-xl border transition-[border-color,transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-focus-visible:-translate-y-0.5"
    :class="[cardClass, layoutClass]"
  >
    <div
      class="relative aspect-[16/10] w-full overflow-hidden bg-white/[0.03]"
      :class="mediaClass"
    >
      <span
        v-if="listing.source === 'founding'"
        class="absolute left-2.5 top-2.5 z-10 inline-flex items-center rounded-full border border-brand-border bg-brand-bg/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-fg/85 backdrop-blur"
      >
        Founding
      </span>
      <img
        v-if="showImage"
        :src="listing.screenshot_url ?? undefined"
        :alt="`${listing.name} screenshot`"
        loading="lazy"
        width="960"
        height="600"
        class="size-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.025] group-focus-visible:scale-[1.025]"
        @error="imageFailed = true"
      >
      <ListingShotFallback
        v-else
        :name="listing.name"
        :generating="generating"
      />
    </div>

    <div class="flex min-w-0 flex-1 flex-col" :class="contentClass">
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          :class="tier.classes"
        >
          <Sparkles v-if="listing.tier === 'featured'" class="size-2.5" />
          {{ tier.label }}
        </span>
        <span v-if="isFeature" class="text-[11px] font-medium text-brand-accent">
          Featured placement
        </span>
        <span v-else-if="isWide" class="text-[11px] font-medium text-brand-fg/70">
          Priority placement
        </span>
      </div>

      <component
        :is="headingLevel"
        class="min-w-0 font-semibold text-brand-fg"
        :class="headingClass"
      >
        {{ listing.name }}
      </component>

      <p
        class="text-sm leading-6 text-brand-muted"
        :class="isSpotlight ? 'line-clamp-3' : 'line-clamp-2'"
      >
        {{ listing.tagline }}
      </p>

      <div v-if="(isFeature || isWide) && aiChips.length" class="flex flex-wrap items-center gap-1.5 pt-1">
        <span class="mr-1 text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
          AI-readable
        </span>
        <span
          v-for="chip in aiChips"
          :key="chip"
          class="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] text-brand-muted ring-1 ring-white/10"
        >
          {{ chip }}
        </span>
      </div>

      <span
        v-if="listing.category"
        class="mt-auto inline-flex w-fit rounded-full border border-brand-border bg-black/10 px-2.5 py-0.5 text-xs text-brand-muted"
      >
        {{ listing.category.name }}
      </span>
    </div>
  </article>
</template>
