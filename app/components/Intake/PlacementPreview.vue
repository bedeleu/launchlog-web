<script setup lang="ts">
import { Search } from '@lucide/vue'
import type { ListingCard, ListingTier } from '~/composables/useListings'

interface PlacementPreviewSource {
  domain: string
  screenshot_url: string | null
}

const props = withDefaults(defineProps<{
  preview: PlacementPreviewSource
  tier: string
  title: string
  tagline: string
  generating?: boolean
  contextScreenshots?: boolean
}>(), {
  generating: false,
  contextScreenshots: true,
})

const isFeatured = computed(() => props.tier === 'featured')
const displayTitle = computed(() => props.title || props.preview.domain || 'Your product')
const displayTagline = computed(() => props.tagline || 'Your one-line pitch goes here')

/**
 * Three illustrative rows, not a full 30-slot production page: the buyer only
 * needs to see the shape of their own card among neighbours. The buyer's own
 * footprint is subtracted, so Featured needs 7 context cards and Standard 8 —
 * each case lands on exactly nine slots.
 */
const PREVIEW_SLOTS = 9
const SAMPLE_IMAGES = 5

const buyerWeight = computed(() => (isFeatured.value ? 2 : 1))

/**
 * Preview-only context. These are static illustrations of neighbouring listings
 * and must never reach a live directory code path — ListingGrid blurs them and
 * makes them inert via contextualSlugs. Live surfaces never pass that prop.
 */
const contextSlugs = computed(() =>
  Array.from({ length: PREVIEW_SLOTS - buyerWeight.value }, (_, index) => `preview-context-${index + 1}`),
)

const contextCards = computed<ListingCard[]>(() => contextSlugs.value.map((slug, index) => ({
  slug,
  name: 'Example product',
  tagline: 'A short pitch from another listing in the directory.',
  url: 'https://example.com',
  screenshot_url: props.contextScreenshots
    ? `/images/samples/${(index % SAMPLE_IMAGES) + 1}.png`
    : null,
  tier: 'basic',
  source: 'seed',
  category: null,
  tags: [],
  tech_stack: [],
  has_llms_txt: true,
  has_schema_org: true,
  has_markdown_negotiation: true,
  country: null,
  published_at: null,
})))

const buyerCard = computed<ListingCard>(() => ({
  slug: 'preview-buyer',
  name: displayTitle.value,
  tagline: displayTagline.value,
  url: `https://${props.preview.domain}`,
  screenshot_url: props.preview.screenshot_url ?? null,
  tier: props.tier as ListingTier,
  source: 'customer',
  category: null,
  tags: [],
  tech_stack: [],
  has_llms_txt: true,
  has_schema_org: true,
  has_markdown_negotiation: true,
  country: null,
  published_at: null,
}))

/**
 * The buyer goes first and every context card is `basic`, so the directory
 * packer lands the buyer on exactly the footprint the live directory would
 * give it: featured -> 2x1 plus one 1x1 companion, standard -> 1x1. Same
 * packer, same card, same grid as production — the preview cannot drift from
 * what we actually ship because it is not a separate implementation.
 */
const previewListings = computed<ListingCard[]>(() => [buyerCard.value, ...contextCards.value])
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
        Your LaunchLog placement
      </h2>
      <span class="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-brand-muted ring-1 ring-white/10">
        Example placement preview
      </span>
    </div>

    <div class="mt-3 overflow-hidden rounded-2xl border border-brand-border bg-[#0c1120] shadow-2xl shadow-black/40">
      <div class="flex items-center gap-2 border-b border-brand-border bg-white/[0.03] px-4 py-2.5">
        <span class="size-2.5 rounded-full bg-white/15" />
        <span class="size-2.5 rounded-full bg-white/15" />
        <span class="size-2.5 rounded-full bg-white/15" />
        <div class="mx-auto flex items-center gap-1.5 rounded-md bg-black/30 px-3 py-1 text-xs text-brand-muted">
          <Search class="size-3" /> launchlog.ai/browse-all
        </div>
      </div>

      <div class="p-5">
        <!-- Only the buyer's tier changes between plan selections, so the grid is
             never destroyed and the screenshot is never re-fetched on a swap. -->
        <ListingGrid
          :listings="previewListings"
          mode="mixed"
          :interactive="false"
          :contextual-slugs="contextSlugs"
          :generating="generating"
        />
      </div>
    </div>

    <dl class="mt-4 grid gap-x-8 gap-y-4 border-y border-white/10 py-4 sm:grid-cols-2">
      <div class="min-w-0">
        <dt class="text-xs font-medium text-brand-muted">
          Listing title
        </dt>
        <dd class="mt-1 break-words text-base font-semibold leading-6 text-white">
          {{ displayTitle }}
        </dd>
      </div>
      <div class="min-w-0">
        <dt class="text-xs font-medium text-brand-muted">
          Website
        </dt>
        <dd class="mt-1 break-all font-mono text-sm leading-6 text-white/90">
          {{ preview.domain }}
        </dd>
      </div>
      <div class="min-w-0 sm:col-span-2">
        <dt class="text-xs font-medium text-brand-muted">
          Short description
        </dt>
        <dd class="mt-1 break-words text-sm leading-6 text-white/80">
          {{ displayTagline }}
        </dd>
      </div>
    </dl>

    <p class="mt-3 text-xs text-brand-muted">
      <template v-if="isFeatured">
        Featured takes the editorial spotlight card, placed first on eligible browse and category
        pages, plus eligibility for one of up to three homepage Featured slots. Order within
        Featured is re-seeded daily — it is not a guaranteed exposure cadence.
      </template>
      <template v-else>
        Standard lists you in the directory with a standard card. Order within Standard is
        re-seeded daily.
      </template>
    </p>
  </div>
</template>
