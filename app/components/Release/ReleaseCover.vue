<script setup lang="ts">
withDefaults(defineProps<{
  src?: string | null
  alt?: string
  title?: string
  loading?: boolean
  mediaClass?: string
  imageClass?: string
}>(), {
  src: null,
  alt: '',
  title: undefined,
  loading: false,
  mediaClass: '',
  imageClass: 'object-cover',
})
</script>

<template>
  <figure
    data-release-cover
    :aria-busy="loading"
    class="overflow-hidden border border-release-seam bg-release-paper text-release-ink"
  >
    <div :class="['relative aspect-[16/10] overflow-hidden bg-[#d7cebc]', mediaClass]">
      <img
        v-if="src"
        :src="src"
        :alt="alt"
        :class="['size-full', imageClass]"
      >
      <div
        v-else
        class="relative grid size-full place-items-center px-8 text-center"
      >
        <span aria-hidden="true" class="absolute inset-y-0 left-1/3 border-l border-release-ink/10" />
        <span aria-hidden="true" class="absolute inset-y-0 right-1/3 border-r border-release-ink/10" />
        <slot name="empty">
          <p class="max-w-sm font-mono text-xs tracking-[0.16em] text-release-ink/70 uppercase">
            {{ loading ? 'Capture in progress' : 'Website capture unavailable' }}
          </p>
        </slot>
      </div>
      <slot name="overlay" />
    </div>
    <figcaption v-if="title || $slots.caption" class="border-t border-release-ink/20 px-4 py-3 sm:px-5">
      <slot name="caption">
        <p class="text-sm font-semibold tracking-[-0.01em]">
          {{ title }}
        </p>
      </slot>
    </figcaption>
  </figure>
</template>
