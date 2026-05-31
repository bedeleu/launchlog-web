<script setup lang="ts">
import { ImageOff, Sparkles } from '@lucide/vue'
import type { ListingCard, ListingTier } from '~/composables/useListings'

const { listing } = defineProps<{ listing: ListingCard }>()

const tierMeta: Record<ListingTier, { label: string, classes: string }> = {
  featured: {
    label: 'Featured',
    classes: 'border-brand-accent/50 bg-brand-accent/10 text-brand-accent shadow-[0_0_24px_rgba(99,102,241,0.25)]',
  },
  premium: {
    label: 'Premium',
    classes: 'border-brand-border bg-white/[0.04] text-brand-fg',
  },
  basic: {
    label: 'Basic',
    classes: 'border-brand-border bg-transparent text-brand-muted',
  },
}

const tier = computed(() => tierMeta[listing.tier] ?? tierMeta.basic)

// Some founding listings carry a screenshot_url whose file isn't on the CDN yet
// (capture pending or a stale snapshot). Fall back to the clean placeholder on
// load error instead of showing the browser's broken-image glyph + alt text.
const imageFailed = ref(false)
watch(() => listing.screenshot_url, () => {
  imageFailed.value = false
})
const showImage = computed(() => Boolean(listing.screenshot_url) && !imageFailed.value)

// Premium/Featured get a subtly stronger card border treatment.
const cardClass = computed(() => {
  if (listing.tier === 'featured')
    return 'border-brand-accent/30 bg-brand-accent/[0.03] hover:border-brand-accent/50'
  if (listing.tier === 'premium')
    return 'border-brand-border bg-white/[0.025] hover:border-brand-accent/40'
  return 'border-brand-border bg-white/[0.02] hover:border-brand-accent/40'
})
</script>

<template>
  <NuxtLink
    :to="`/listing/${listing.slug}`"
    class="group flex flex-col overflow-hidden rounded-xl border transition-colors"
    :class="cardClass"
  >
    <!-- Screenshot thumb: fixed 16:10 aspect to avoid layout shift -->
    <div class="relative aspect-[16/10] w-full overflow-hidden bg-white/[0.03]">
      <!-- Founding listing marker (D-060) — origin, independent of billing tier -->
      <span
        v-if="listing.source === 'founding'"
        class="absolute left-2 top-2 z-10 inline-flex items-center rounded-full border border-brand-border bg-brand-bg/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-fg/85 backdrop-blur"
      >
        Founding
      </span>
      <img
        v-if="showImage"
        :src="listing.screenshot_url ?? undefined"
        :alt="`${listing.name} screenshot`"
        loading="lazy"
        width="640"
        height="400"
        class="size-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
        @error="imageFailed = true"
      >
      <div v-else class="flex size-full items-center justify-center text-brand-muted">
        <ImageOff class="size-6" />
      </div>
    </div>

    <div class="flex min-w-0 flex-1 flex-col gap-2 p-4">
      <div class="flex items-start justify-between gap-2">
        <span class="truncate font-medium text-brand-fg">{{ listing.name }}</span>
        <span
          class="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          :class="tier.classes"
        >
          <Sparkles v-if="listing.tier === 'featured'" class="size-2.5" />
          {{ tier.label }}
        </span>
      </div>

      <p class="line-clamp-2 text-sm text-brand-muted">
        {{ listing.tagline }}
      </p>

      <span
        v-if="listing.category"
        class="mt-auto inline-flex w-fit rounded-full border border-brand-border px-2.5 py-0.5 text-xs text-brand-muted"
      >
        {{ listing.category.name }}
      </span>
    </div>
  </NuxtLink>
</template>
