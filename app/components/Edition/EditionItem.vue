<script setup lang="ts">
import type { EditionItem } from '#shared/types/editions'
import { safeExternalHttpUrl } from '~/utils/safe-public-url'

const props = defineProps<{
  item: EditionItem
}>()

const position = computed(() => String(props.item.position).padStart(2, '0'))
const proofUrl = computed(() => props.item.current
  ? safeExternalHttpUrl(props.item.provenance_url)
  : undefined)
const imageUrl = computed(() => safeExternalHttpUrl(props.item.image_url))
const imageFailed = ref(false)
const showImage = computed(() => Boolean(imageUrl.value) && !imageFailed.value)

watch(() => props.item.image_url, () => {
  imageFailed.value = false
})
</script>

<template>
  <article class="grid border-b border-release-seam bg-release-ink md:grid-cols-[4rem_minmax(0,1fr)]">
    <div class="border-b border-release-seam px-4 py-4 font-mono text-xs font-semibold tracking-[0.14em] text-release-paper-muted md:border-r md:border-b-0">
      {{ position }}
    </div>

    <div
      class="grid min-w-0"
      :class="showImage ? 'md:grid-cols-[minmax(0,1fr)_12rem]' : 'grid-cols-1'"
    >
      <div class="min-w-0 p-5 sm:p-6">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[0.65rem] font-semibold tracking-[0.12em] uppercase">
          <span class="text-release-paper-muted">{{ item.tier_label }}</span>
          <span class="text-release-paper-muted">{{ item.shipped_at }}</span>
          <span v-if="item.carried_over" class="text-release-warning">Reported after cutoff</span>
          <span v-if="!item.current" class="text-release-warning">No longer active</span>
        </div>

        <h2 class="mt-4 text-xl font-semibold tracking-[-0.025em] text-[#f6f1e7] sm:text-2xl">
          <NuxtLink
            v-if="item.current && item.listing_path"
            :to="item.listing_path"
            rel="noopener sponsored"
            class="transition-colors hover:text-release-blaze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus focus-visible:ring-offset-4 focus-visible:ring-offset-release-ink"
          >
            {{ item.name }}
          </NuxtLink>
          <span v-else>{{ item.name }}</span>
        </h2>

        <p v-if="item.tagline" class="mt-2 max-w-2xl text-sm leading-6 text-release-paper-muted sm:text-base sm:leading-7">
          {{ item.tagline }}
        </p>

        <a
          v-if="proofUrl"
          :href="proofUrl"
          target="_blank"
          rel="noopener"
          class="mt-5 inline-flex min-h-8 items-center border-b border-release-blaze font-mono text-[0.68rem] font-semibold tracking-[0.1em] text-release-paper uppercase transition-colors hover:text-release-blaze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus focus-visible:ring-offset-4 focus-visible:ring-offset-release-ink"
        >
          Release proof ↗
        </a>
      </div>

      <div v-if="showImage" class="border-t border-release-seam bg-release-rail md:border-t-0 md:border-l">
        <img
          :src="imageUrl ?? undefined"
          :alt="`${item.name} website screenshot`"
          loading="lazy"
          width="384"
          height="240"
          class="aspect-[16/10] size-full object-contain object-top"
          @error="imageFailed = true"
        >
      </div>
    </div>
  </article>
</template>
