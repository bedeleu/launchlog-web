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

// Every directory card is one row tall, so the API's 30-slot page and the
// grid's cells stay the same unit. half-tall is the homepage editorial lead and
// the only remaining row span; row-span only from lg up, because at two columns
// a spanned row would open a blank cell.
const spanClass: Record<PlacementSpan, string> = {
  'unit': '',
  // Two columns only where there are three. At the sm/md two-column breakpoint a
  // 2-wide Featured plus its 1-wide companion cannot tile: the companion takes
  // column 1 and the next Featured wraps, stranding column 2. Sparse
  // auto-placement never backfills, and grid-flow-dense would reorder cards away
  // from the paid ordering, so the Featured simply collapses to one column there.
  'double': 'lg:col-span-2',
  'half-tall': 'sm:col-span-2 lg:col-span-2 lg:row-span-2',
  'full-short': 'sm:col-span-2 lg:col-span-3',
}

const contextual = computed(() => new Set(props.contextualSlugs))
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
        class="mb-4 hidden border-b border-white/10 pb-2.5 font-mono text-xs font-medium uppercase tracking-[0.22em] text-brand-fg lg:block"
      >
        Featured launches
      </p>

      <div v-else-if="index > 0" class="mb-6 mt-6 border-t border-white/10" />

      <div class="grid auto-rows-auto grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <component
          :is="interactive && !contextual.has(item.listing.slug) ? NuxtLink : 'div'"
          v-for="item in segment.items"
          :key="item.listing.slug"
          :to="interactive && !contextual.has(item.listing.slug) ? `/listing/${item.listing.slug}` : undefined"
          :aria-hidden="contextual.has(item.listing.slug) ? 'true' : undefined"
          :tabindex="contextual.has(item.listing.slug) ? -1 : undefined"
          class="group block min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
          :class="[
            spanClass[item.span],
            // Every other card focuses in the brand accent. The directory Featured card
            // is differentiated without indigo, and that has to hold in its focus state
            // too, so it takes an equally visible neutral ring instead.
            item.variant === 'directory-spotlight' ? 'focus-visible:ring-white/70' : 'focus-visible:ring-brand-accent',
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
  </div>
</template>
