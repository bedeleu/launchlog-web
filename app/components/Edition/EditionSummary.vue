<script setup lang="ts">
import type { EditionSummary } from '#shared/types/editions'

const props = defineProps<{
  summary: EditionSummary
}>()

const launchCount = computed(() =>
  `${props.summary.item_count} ${props.summary.item_count === 1 ? 'launch' : 'launches'}`,
)
</script>

<template>
  <article class="group grid gap-4 border-b border-release-seam py-6 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-start sm:gap-6">
    <div class="font-mono text-[0.68rem] font-semibold tracking-[0.16em] text-release-warning uppercase">
      {{ summary.slug }}
    </div>

    <div class="min-w-0">
      <h2 class="text-xl font-semibold tracking-[-0.025em] text-[#f6f1e7] sm:text-2xl">
        <NuxtLink
          :to="summary.path"
          class="transition-colors hover:text-release-blaze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus focus-visible:ring-offset-4 focus-visible:ring-offset-release-ink"
        >
          What shipped {{ summary.week_starts_at }}–{{ summary.week_ends_at }}
        </NuxtLink>
      </h2>
      <p v-if="summary.introduction" class="mt-2 max-w-3xl text-sm leading-6 text-release-paper-muted sm:text-base sm:leading-7">
        {{ summary.introduction }}
      </p>
    </div>

    <div class="flex items-center gap-2 font-mono text-[0.68rem] font-medium tracking-[0.1em] text-release-paper-muted uppercase sm:justify-end">
      <span aria-hidden="true" class="size-2 bg-release-blaze" />
      {{ launchCount }}
    </div>
  </article>
</template>
