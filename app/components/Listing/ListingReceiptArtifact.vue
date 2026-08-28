<script setup lang="ts">
import type { ListingProofDestination } from '~/utils/customer-receipt'

/**
 * One row of the published record's proof ledger.
 *
 * The address is the link text. A ledger that hid four different URLs behind
 * four verbs would be indistinguishable from one that pointed all four at the
 * same page — printing the address is what makes the destinations checkable.
 */
const props = defineProps<{
  destination: ListingProofDestination
}>()

/** The scheme is chrome; the reader is checking the path. */
const printedUrl = computed(() => props.destination.url.replace(/^https?:\/\//, ''))
</script>

<template>
  <div
    class="flex flex-col gap-2 py-4"
    :data-proof="destination.key"
  >
    <div class="min-w-0">
      <p class="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-release-paper">
        {{ destination.label }}
      </p>
      <p class="mt-1 max-w-prose text-sm leading-6 text-release-paper-muted">
        {{ destination.description }}
      </p>
    </div>
    <a
      :href="destination.url"
      class="w-full max-w-full break-all font-mono text-xs leading-5 text-release-blaze underline-offset-4 transition-colors hover:text-[#ff7958] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus focus-visible:ring-offset-2 focus-visible:ring-offset-release-ink"
    >
      {{ printedUrl }}
    </a>
  </div>
</template>
