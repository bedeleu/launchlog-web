<script setup lang="ts">
import type { ListingCard as ListingCardData } from '~/composables/useListings'
import type { PlacedListing, PlacementSpan } from '~/utils/listing-placement'
import { NuxtLink } from '#components'
import { packHomepageFeatured, packMixedTierPage, packUniform } from '~/utils/listing-placement'

const props = withDefaults(defineProps<{
  listings: ListingCardData[]
  mode?: 'mixed' | 'uniform' | 'homepage-featured'
  /** Preview renders inert cards; production always navigates. */
  interactive?: boolean
  /** Preview-only: slugs rendered as blurred context. Never set on live surfaces. */
  contextualSlugs?: string[]
  generating?: boolean
  /** Forwarded to every card; top-level directory pages pass 'h2'. */
  headingLevel?: 'h2' | 'h3'
}>(), {
  mode: 'uniform',
  interactive: true,
  contextualSlugs: () => [],
  generating: false,
  headingLevel: 'h3',
})

const placed = computed<PlacedListing<ListingCardData>[]>(() => {
  if (props.mode === 'mixed') return packMixedTierPage(props.listings)
  if (props.mode === 'homepage-featured') return packHomepageFeatured(props.listings)
  return packUniform(props.listings)
})

// Every mixed directory card is one row tall, so the API's 30-slot page and the
// grid's cells stay the same unit. half-tall is the homepage editorial lead and
// the only remaining row span; row-span only from lg up, because at two columns
// a spanned row would open a blank cell.
const spanClass: Record<PlacementSpan, string> = {
  'unit': '',
  // Two columns only where there are three. At the sm/md two-column breakpoint a
  // 2-wide Premium plus its 1-wide companion cannot tile: the companion takes
  // column 1 and the next Premium wraps, stranding column 2. Sparse auto-placement
  // never backfills, and grid-flow-dense would reorder cards away from the paid
  // ordering, so the Premium simply collapses to one column there instead.
  'double': 'lg:col-span-2',
  'half-tall': 'sm:col-span-2 lg:col-span-2 lg:row-span-2',
  'full-short': 'sm:col-span-2 lg:col-span-3',
}

const contextual = computed(() => new Set(props.contextualSlugs))
</script>

<template>
  <div class="grid auto-rows-auto grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
    <component
      :is="interactive && !contextual.has(item.listing.slug) ? NuxtLink : 'div'"
      v-for="item in placed"
      :key="item.listing.slug"
      :to="interactive && !contextual.has(item.listing.slug) ? `/listing/${item.listing.slug}` : undefined"
      :aria-hidden="contextual.has(item.listing.slug) ? 'true' : undefined"
      :tabindex="contextual.has(item.listing.slug) ? -1 : undefined"
      class="group block min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
      :class="[
        spanClass[item.span],
        contextual.has(item.listing.slug) ? 'pointer-events-none select-none opacity-55 blur-[1.5px]' : '',
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
