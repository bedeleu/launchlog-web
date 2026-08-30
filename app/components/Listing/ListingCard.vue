<script setup lang="ts">
import type { ListingCard } from '~/composables/useListings'
import type { ListingCardVariant } from '~/utils/listing-placement'
import { releaseEdition } from '~/utils/release-edition'

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
const isDirectoryCompanion = computed(() => props.variant === 'directory-companion')
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
 * The ledger register: the tier is disclosed in the bottom register line —
 * FEATURED · category · domain · listing date — never as a pill or a mark above
 * the name. Standard entries carry no tier word; being unmarked is the entry
 * tier, and an unknown tier value is treated the same rather than trusted.
 *
 * The edition marker is the date LaunchLog listed the release. The approved comp
 * prints a catalog number and a barcode; neither exists as real data, so the
 * catalog prints the one durable identifier it actually holds.
 *
 * Category and the date never break internally; the domain stays breakable
 * because a hostname wider than the column would otherwise overflow. The
 * separators glue their middot to the preceding fact with a non-breaking space
 * and allow a break after it, so a long fact drops whole to the next line.
 */
const registerFacts = computed(() => {
  const facts: Array<{ text: string, breakable: boolean }> = []

  if (props.listing.category) facts.push({ text: props.listing.category.name, breakable: false })
  if (registerHost.value) facts.push({ text: registerHost.value, breakable: true })

  const edition = releaseEdition(props.listing.published_at)
  if (edition) facts.push({ text: edition, breakable: false })

  return facts
})

const showTierWord = computed(() => props.listing.tier === 'featured')
const hasRegisterLine = computed(() => showTierWord.value || registerFacts.value.length > 0)

/** The perforated rule that closes a standard cover. Steps in weight with the tier. */
const registerRuleClass = computed(() =>
  showTierWord.value ? 'border-release-paper/35' : 'border-release-seam')

/**
 * 12px/20px register text on the rail plate: release-paper measures 14.9:1 and
 * release-paper-muted 10.3:1 against the rail, both far clear of WCAG AA. The
 * earlier fg-opacity registers measured 3.69:1 on the Featured surface and are
 * not reintroduced.
 */
const registerToneClass = computed(() =>
  showTierWord.value ? 'text-release-paper' : 'text-release-paper-muted')

const registerSpacingClass = computed(() =>
  isDirectoryCompanion.value ? 'lg:pt-1.5 lg:leading-4' : '')

const imageFailed = ref(false)
watch(() => props.listing.screenshot_url, () => {
  imageFailed.value = false
})
const showImage = computed(() => Boolean(props.listing.screenshot_url) && !imageFailed.value)

/**
 * A Featured capture is evidence, not decorative cover art. Its split layout is
 * often taller than the source 16:10 image, so cover would crop both horizontal
 * edges. Keep Featured captures complete; ordinary directory covers retain the
 * denser crop used by the standard grid.
 */
const imageFitClass = computed(() =>
  isDirectoryCompanion.value || isPriorityPlacement.value || props.listing.tier === 'featured'
    ? 'object-contain object-top'
    : 'object-cover object-top')

const cardClass = computed(() => {
  // Release covers are square-cornered ink plates with hairline seams. The tier
  // steps the seam value only; composition and the obi band carry the placement,
  // and no tier is told apart by an accent colour.
  if (isPriorityPlacement.value) {
    return 'border-release-paper/40 bg-release-rail group-hover:border-release-paper/70 group-focus-visible:border-release-paper/70'
  }

  if (props.listing.tier === 'featured') {
    return 'border-release-paper/25 bg-release-rail group-hover:border-release-paper/45 group-focus-visible:border-release-paper/45'
  }

  return 'border-release-seam bg-release-rail group-hover:border-release-paper-muted/45 group-focus-visible:border-release-paper-muted/45'
})

// The directory grid row also contains a denser Standard companion. Let the
// Featured proof keep its own natural height instead of inheriting that taller
// row and exposing empty rail between the 16:10 capture and the obi.
const articleHeightClass = computed(() =>
  isDirectorySpotlight.value ? 'lg:h-auto' : '')

const layoutClass = computed(() => {
  if (isSpotlight.value) return 'md:grid md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]'
  // The capture stays the wide track because the customer's product is what
  // Featured actually sells. The 1.7:1 split keeps the evidence dominant; the
  // rail density, rather than a stretched capture, closes the row at narrow
  // desktop widths while 2xl restores the more editorial spacing.
  if (isDirectorySpotlight.value) return 'flex flex-col lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]'
  return 'flex flex-col'
})

/**
 * Below the split breakpoint both directory cards stay ordinary stacked covers
 * with a 16/10 capture, so the seam runs under the cover. Once the cover moves
 * into its own grid track the seam turns and runs beside it.
 */
const mediaClass = computed(() => {
  if (isSpotlight.value) return 'border-b md:aspect-auto md:h-full md:border-b-0 md:border-r'
  if (isDirectorySpotlight.value) return 'border-b lg:aspect-[16/10] lg:h-auto lg:self-start lg:border-b-0 lg:border-r'
  if (isDirectoryCompanion.value) return 'border-b lg:aspect-[16/10]'
  return 'border-b'
})

const contentClass = computed(() => {
  if (isSpotlight.value) return 'gap-3 p-5 md:p-6'
  if (isDirectorySpotlight.value) return 'gap-3 p-5 lg:gap-2 lg:justify-center lg:p-4 2xl:gap-2 2xl:p-5'
  if (isDirectoryCompanion.value) return 'gap-2 p-4 lg:gap-1 lg:p-2'
  return 'gap-2 p-4'
})

const headingClass = computed(() => {
  if (isSpotlight.value) return 'line-clamp-2 text-2xl leading-[1.15] tracking-[-0.03em] md:text-3xl'
  if (isDirectorySpotlight.value) return 'line-clamp-3 text-xl leading-6 tracking-[-0.025em] 2xl:text-2xl 2xl:leading-7'
  return 'truncate tracking-[-0.02em]'
})

/**
 * The obi splits into two columns only once the card is actually wide enough to
 * hold both halves — the same breakpoint at which its layout splits. Splitting
 * earlier stranded a three-line register beside a single-line descriptor at 768.
 */
const obiSplitClass = computed(() =>
  isSpotlight.value
    ? 'md:flex-row md:items-baseline md:justify-between md:gap-x-4'
    : 'lg:flex-row lg:items-baseline lg:justify-between lg:gap-x-4')

const taglineClass = computed(() => {
  if (isDirectorySpotlight.value) return 'line-clamp-4 text-sm leading-6 lg:leading-5 2xl:leading-6'
  // Homepage spotlights have enough width for the larger editorial treatment.
  if (isPriorityPlacement.value) return 'line-clamp-3 text-base leading-7'
  if (isDirectoryCompanion.value) return 'line-clamp-2 text-sm leading-6 lg:line-clamp-1 lg:leading-5'
  return 'line-clamp-2 text-sm leading-6'
})
</script>

<template>
  <!-- Still, by request: no hover motion on the card or the screenshot. The only
       hover feedback is the seam-colour step from cardClass. -->
  <article
    class="flex h-full min-w-0 flex-col overflow-hidden border transition-colors duration-200"
    :class="[cardClass, articleHeightClass]"
  >
    <!-- The split lives on an inner wrapper so the directory Featured card can
         close with an obi band that runs under cover and text alike. -->
    <div class="flex min-w-0 flex-1 flex-col" :class="layoutClass">
      <div
        class="relative aspect-[16/10] w-full overflow-hidden border-release-seam bg-release-ink"
        :class="mediaClass"
      >
        <!-- A printed corner stamp rather than a floating pill: square, seamed
             into the cover edge, and legible over any screenshot without blur. -->
        <span
          v-if="listing.source === 'founding'"
          class="absolute left-0 top-0 z-10 inline-flex items-center border-b border-r border-release-seam bg-release-ink/90 px-2 py-1 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-release-paper"
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
          class="size-full"
          :class="imageFitClass"
          @error="imageFailed = true"
        >
        <ListingShotFallback
          v-else
          :name="listing.name"
          :generating="generating"
        />
      </div>

      <div class="flex min-w-0 flex-1 flex-col" :class="contentClass">
        <!-- Nothing above the name, in any tier: the heading carries its own weight
             and the tier is disclosed in the ledger register at the bottom. -->
        <component
          :is="headingLevel"
          class="min-w-0 font-semibold text-[#f6f1e7]"
          :class="headingClass"
        >
          {{ listing.name }}
        </component>

        <p class="text-release-paper-muted" :class="taglineClass">
          {{ listing.tagline }}
        </p>

        <p
          v-if="!isPriorityPlacement && hasRegisterLine"
          class="mt-auto break-words border-t border-dashed pt-2.5 font-mono text-xs leading-5"
          :class="[registerRuleClass, registerToneClass, registerSpacingClass]"
        >
          <template v-if="showTierWord">
            <span
              class="whitespace-nowrap font-medium uppercase tracking-[0.18em] text-release-paper"
            >{{ listing.tier }}</span>
          </template>
          <template v-for="(fact, index) in registerFacts" :key="fact.text">
            <span v-if="showTierWord || index > 0">{{ '\u00A0· ' }}</span>
            <span :class="fact.breakable ? '' : 'whitespace-nowrap'">{{ fact.text }}</span>
          </template>
        </p>
      </div>
    </div>

    <!-- The obi. Featured closes on a warm paper band that runs the full width of
         the cover, inverting the plate exactly once so the tier reads from
         material and structure — no other card has a strip, and the directory's
         blaze accent stays reserved for action. The priority-placement disclosure
         lives here, naming the purchased benefit (both plans are paid, so "paid"
         differentiates nothing). Explicit stacked-then-two-column layout: at
         390px flex-wrap dropped the descriptor onto an accidental second row. -->
    <div
      v-if="isPriorityPlacement && hasRegisterLine"
      class="flex flex-col gap-y-1 border-t border-release-paper/40 bg-release-paper px-5 py-3 font-mono text-xs leading-5 text-release-ink/80 md:px-6"
      :class="obiSplitClass"
    >
      <p class="min-w-0 break-words">
        <span class="whitespace-nowrap font-semibold uppercase tracking-[0.3em] text-release-ink">{{ listing.tier }}</span>
        <template v-for="fact in registerFacts" :key="fact.text">
          <span>{{ '\u00A0· ' }}</span>
          <span :class="fact.breakable ? '' : 'whitespace-nowrap'">{{ fact.text }}</span>
        </template>
      </p>
      <p class="whitespace-nowrap font-medium">
        Priority placement
      </p>
    </div>
  </article>
</template>
