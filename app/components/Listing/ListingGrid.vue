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
}>(), {
  mode: 'uniform',
  interactive: true,
  contextualSlugs: () => [],
  generating: false,
})

const placed = computed<PlacedListing<ListingCardData>[]>(() => {
  if (props.mode === 'mixed') return packMixedTierPage(props.listings)
  if (props.mode === 'homepage-featured') return packHomepageFeatured(props.listings)
  return packUniform(props.listings)
})

// row-span only from lg up: at two columns a spanned row would open a blank cell.
const spanClass: Record<PlacementSpan, string> = {
  'unit': '',
  'half-tall': 'sm:col-span-2 lg:col-span-2 lg:row-span-2',
  'full-tall': 'sm:col-span-2 lg:col-span-3 lg:row-span-2',
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
      />
    </component>
  </div>
</template>
