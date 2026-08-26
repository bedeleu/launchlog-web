<script setup lang="ts">
import type { ListingCard } from '~/composables/useListings'
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

/** Homepage Featured: full-width and horizontal from md. */
const isSpotlight = computed(() => props.variant === 'spotlight')
/**
 * Directory Featured: an ordinary directory tile on the double-width directory
 * footprint, at its natural row height. It earns its distinction from composition
 * and typography — a register rule, a display-scale name, one line of record —
 * rather than from extra size or a colour the rest of the directory does not use.
 */
const isDirectorySpotlight = computed(() => props.variant === 'directory-spotlight')
const isPriorityPlacement = computed(() => isSpotlight.value || isDirectorySpotlight.value)

/** Register host: real product truth, nothing invented. */
const registerHost = computed(() => {
  try {
    return new URL(props.listing.url).hostname.replace(/^www\./, '')
  }
  catch {
    return ''
  }
})

/**
 * The ledger register (approved Concept C): the tier is disclosed in the bottom
 * register line — FEATURED · category · domain — never as a pill or a mark above
 * the name. Standard entries carry no tier word; being unmarked is the entry
 * tier, and an unknown tier value is treated the same rather than trusted.
 * The rule above the line steps down in weight with the tier.
 */
const registerRuleClass = computed(() =>
  props.listing.tier === 'featured' ? 'border-white/35' : 'border-white/15')

const hasRegisterLine = computed(() =>
  props.listing.tier === 'featured' || Boolean(props.listing.category) || registerHost.value !== '')

const imageFailed = ref(false)
watch(() => props.listing.screenshot_url, () => {
  imageFailed.value = false
})
const showImage = computed(() => Boolean(props.listing.screenshot_url) && !imageFailed.value)

const cardClass = computed(() => {
  // Featured placement uses one monochrome frame-and-register system everywhere.
  // Composition changes with available width, but the product never changes its
  // visual status because it happens to be first in a list.
  if (isPriorityPlacement.value) {
    return 'border-2 border-white/40 bg-white/[0.05] group-hover:border-white/60 group-focus-visible:border-white/60'
  }

  // Everywhere else the two tiers share one flat neutral system: surface value
  // and hairline weight step with the tier, and no tier is told apart by indigo.
  if (props.listing.tier === 'featured') {
    return 'border-white/25 bg-white/[0.03] group-hover:border-white/45 group-focus-visible:border-white/45'
  }

  return 'border-brand-border bg-white/[0.02] group-hover:border-white/30 group-focus-visible:border-white/30'
})

const layoutClass = computed(() => {
  if (isSpotlight.value) return 'md:grid md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]'
  // No fixed height: the row is whatever its real Basic companion establishes,
  // which matches the double-width spotlight layout. The screenshot takes the
  // wide track because the customer's product is what Featured actually sells.
  // The base flex column is load bearing: without it the article is a block
  // below lg, h-full's surplus row height falls below the content, and the
  // ledger rule floats above dead space instead of anchoring to the bottom.
  if (isDirectorySpotlight.value) return 'flex flex-col lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]'
  return 'flex flex-col'
})

/** Below lg both directory cards stay ordinary stacked cards with a 16/10 shot. */
const mediaClass = computed(() => {
  if (isSpotlight.value) return 'md:aspect-auto md:h-full'
  if (isDirectorySpotlight.value) return 'lg:aspect-auto lg:h-full'
  return ''
})

const contentClass = computed(() => {
  if (isSpotlight.value) return 'gap-3 p-5 md:p-6'
  if (isDirectorySpotlight.value) return 'gap-3 p-5 lg:p-6'
  return 'gap-2 p-4'
})

const headingClass = computed(() => {
  if (isSpotlight.value) return 'line-clamp-2 text-2xl leading-[1.1] tracking-tight md:text-3xl'
  if (isDirectorySpotlight.value) return 'line-clamp-3 text-xl leading-6 tracking-tight 2xl:text-2xl 2xl:leading-7'
  return 'truncate'
})

const taglineClass = computed(() => {
  if (isDirectorySpotlight.value) return 'line-clamp-4 text-sm leading-6'
  // Homepage spotlights have enough width for the larger editorial treatment.
  if (isPriorityPlacement.value) return 'line-clamp-3 text-base leading-7'
  return 'line-clamp-2 text-sm leading-6'
})
</script>

<template>
  <!-- Still, by request: no hover motion on the card or the screenshot. The only
       hover feedback is the border-colour step from cardClass. -->
  <article
    class="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border transition-colors duration-200"
    :class="cardClass"
  >
    <!-- The split lives on an inner wrapper so the directory Featured card can
         close with a register strip that runs under image and text alike. -->
    <div class="flex min-w-0 flex-1 flex-col" :class="layoutClass">
      <div
        class="relative aspect-[16/10] w-full overflow-hidden bg-white/[0.03]"
        :class="mediaClass"
      >
      <span
        v-if="listing.source === 'founding'"
        class="absolute left-2.5 top-2.5 z-10 inline-flex items-center rounded-sm border border-white/15 bg-brand-bg/85 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-brand-fg/85 backdrop-blur"
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
        class="size-full object-cover object-top"
        :class="isDirectorySpotlight ? 'absolute inset-0' : ''"
        @error="imageFailed = true"
      >
      <!-- Featured placement is monochrome on every surface. -->
      <ListingShotFallback
        v-else
        :name="listing.name"
        :generating="generating"
        neutral
      />
    </div>

    <div class="flex min-w-0 flex-1 flex-col" :class="contentClass">
      <!-- Nothing above the name, in any tier: the heading carries its own weight
           and the tier is disclosed in the ledger register at the bottom. -->
      <component
        :is="headingLevel"
        class="min-w-0 font-semibold text-brand-fg"
        :class="headingClass"
      >
        {{ listing.name }}
      </component>

      <p class="text-brand-muted" :class="taglineClass">
        {{ listing.tagline }}
      </p>

      <!-- The ledger register. Wraps rather than truncates: a domain cut mid-word
           reads as a rendering bug, and the card has no fixed height to protect.
           The tier word and category never break internally; the separators are
           ordinary spaces so a long domain drops whole to the next line, and
           break-words stays as the last resort for a hostname wider than the
           column, which one unbreakable token would otherwise overflow.
           12px/20px with fg-opacity neutrals: brand-muted measured under 4.5:1 on
           the lifted Featured surfaces, so Featured metadata reads at fg/70 and
           Standard keeps a quieter fg/60 — both clear WCAG AA with margin. -->
      <p
        v-if="!isPriorityPlacement && hasRegisterLine"
        class="mt-auto break-words border-t pt-2.5 font-mono text-xs leading-5"
        :class="[registerRuleClass, listing.tier === 'featured' ? 'text-brand-fg/70' : 'text-brand-fg/60']"
      >
        <template v-if="listing.tier === 'featured'">
          <span
            class="whitespace-nowrap font-medium uppercase tracking-[0.18em] text-brand-fg"
          >{{ listing.tier }}</span>
          <span v-if="listing.category || registerHost">{{ '\u00A0· ' }}</span>
        </template>
        <span v-if="listing.category" class="whitespace-nowrap">{{ listing.category.name }}</span>
        <span v-if="listing.category && registerHost">{{ '\u00A0· ' }}</span>
        <span v-if="registerHost">{{ registerHost }}</span>
      </p>
    </div>
    </div>

    <!-- The Featured register runs under image and text alike as a
         tonal band: one surface step brighter than the card, never leaving the
         dark theme. Structure carries the tier — no other card has a strip —
         and the priority-placement disclosure lives here, on the Featured card
         itself, naming the purchased benefit (both plans are paid, so "paid"
         differentiates nothing). Explicit stacked-then-two-column layout: at
         390px flex-wrap dropped the descriptor onto an accidental second row. -->
    <div
      v-if="isPriorityPlacement && hasRegisterLine"
      class="flex flex-col gap-y-1 border-t border-white/25 bg-white/[0.08] px-5 py-3 font-mono text-xs leading-5 text-brand-fg/70 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-4 md:px-6"
    >
      <p class="min-w-0 break-words">
        <span class="whitespace-nowrap font-semibold uppercase tracking-[0.3em] text-brand-fg">{{ listing.tier }}</span>
        <span v-if="listing.category || registerHost">{{ '\u00A0· ' }}</span>
        <span v-if="listing.category" class="whitespace-nowrap">{{ listing.category.name }}</span>
        <span v-if="listing.category && registerHost">{{ '\u00A0· ' }}</span>
        <span v-if="registerHost">{{ registerHost }}</span>
      </p>
      <p class="whitespace-nowrap">
        Priority placement
      </p>
    </div>
  </article>
</template>
