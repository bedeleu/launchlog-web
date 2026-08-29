<script setup lang="ts">
import type { ListingCard as ListingCardData } from '~/composables/useListings'
import type { PlacedListing, PlacementSpan } from '~/utils/listing-placement'
import { NuxtLink } from '#components'
import { packDirectoryPage, packHomepageFeatured, packUniform } from '~/utils/listing-placement'

const props = withDefaults(defineProps<{
  listings: ListingCardData[]
  mode?: 'mixed' | 'uniform' | 'homepage-featured'
  /** Preview renders inert cards; production always navigates. */
  interactive?: boolean
  /** Preview-only: slugs rendered as blurred context. Never set on live surfaces. */
  contextualSlugs?: string[]
  /** Preview-only: keep one context card on phones so the purchase form stays nearby. */
  compactContextOnMobile?: boolean
  generating?: boolean
  /** Forwarded to every card; top-level directory pages pass 'h2'. */
  headingLevel?: 'h2' | 'h3'
}>(), {
  mode: 'uniform',
  interactive: true,
  contextualSlugs: () => [],
  compactContextOnMobile: false,
  generating: false,
  headingLevel: 'h3',
})

interface GridSegment {
  key: string
  /** The Featured section opens with its register; the Standard grid never does. */
  register: boolean
  items: PlacedListing<ListingCardData>[]
}

/**
 * mixed splits one API page into the Featured section and the Standard grid —
 * a presentation boundary over the same data, so a page without Featured
 * records renders as the ordinary grid with no header and no empty container.
 */
const segments = computed<GridSegment[]>(() => {
  if (props.mode === 'mixed') {
    const page = packDirectoryPage(props.listings)

    return [
      { key: 'featured', register: true, items: page.featured },
      { key: 'standard', register: false, items: page.standard },
    ].filter(segment => segment.items.length > 0)
  }

  const items = props.mode === 'homepage-featured'
    ? packHomepageFeatured(props.listings)
    : packUniform(props.listings)

  return items.length ? [{ key: props.mode, register: false, items }] : []
})

// Every card is one row tall, so the API's 30-slot directory page and the grid's
// cells stay the same unit. Homepage Featured cards use equal compact cells;
// no surface receives a size advantage based on list order.
const spanClass: Record<PlacementSpan, string> = {
  'unit': '',
  // Two columns only where there are three. At the sm/md two-column breakpoint a
  // 2-wide Featured plus its 1-wide companion cannot tile: the companion takes
  // column 1 and the next Featured wraps, stranding column 2. Sparse
  // auto-placement never backfills, and grid-flow-dense would reorder cards away
  // from the paid ordering, so the Featured simply collapses to one column there.
  'double': 'lg:col-span-2',
  'full-short': 'sm:col-span-2 lg:col-span-3',
}

const contextual = computed(() => new Set(props.contextualSlugs))
const compactedContext = computed(() => new Set(
  props.compactContextOnMobile ? props.contextualSlugs.slice(1) : [],
))
</script>

<template>
  <div>
    <template v-for="(segment, index) in segments" :key="segment.key">
      <!-- The Featured section register: a label over a hairline, not a
           container. "Priority placement" lives on the Featured card itself so
           the real Standard companion in each row is never mislabeled. Below lg
           the paid span collapses and the companion no longer sits beside its
           Featured row, so the section register would falsely scope over it —
           each card's own register carries the tier truth there instead. -->
      <p
        v-if="segment.register"
        class="mb-4 hidden border-b border-release-seam pb-2.5 font-mono text-xs font-medium uppercase tracking-[0.22em] text-release-paper lg:block"
      >
        Featured launches
      </p>

      <div v-else-if="index > 0" class="mb-6 mt-6 border-t border-release-seam" />

      <div class="grid auto-rows-auto grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <component
          :is="interactive && !contextual.has(item.listing.slug) ? NuxtLink : 'div'"
          v-for="item in segment.items"
          :key="item.listing.slug"
          :to="interactive && !contextual.has(item.listing.slug) ? `/listing/${item.listing.slug}` : undefined"
          :aria-hidden="contextual.has(item.listing.slug) ? 'true' : undefined"
          :tabindex="contextual.has(item.listing.slug) ? -1 : undefined"
          class="group block min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus focus-visible:ring-offset-2 focus-visible:ring-offset-release-ink"
          :class="[
            spanClass[item.span],
            contextual.has(item.listing.slug) ? 'pointer-events-none select-none opacity-55 blur-[1.5px]' : '',
            compactedContext.has(item.listing.slug) ? 'hidden sm:block' : '',
          ]"
        >
          <ListingCard
            :listing="item.listing"
            :variant="item.variant"
            :generating="generating"
            :heading-level="headingLevel"
          />
        </component>
      </div>
    </template>
  </div>
</template>
