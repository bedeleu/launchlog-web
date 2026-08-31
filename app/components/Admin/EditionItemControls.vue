<script setup lang="ts">
import type { AdminEditionItem } from '~/composables/useAdminEditions'

const props = defineProps<{ item: AdminEditionItem, pending: boolean, visibilityPending: boolean }>()
const emit = defineEmits<{ visibility: [itemId: string, visible: boolean] }>()
</script>

<template>
  <div class="flex min-w-0 items-center justify-between gap-4 border border-release-seam bg-release-rail p-4">
    <div class="min-w-0">
      <p class="truncate text-sm font-semibold text-release-paper">{{ item.snapshot_name }}</p>
      <p class="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-release-paper-muted">
        {{ item.visible ? 'Visible in this edition' : 'Hidden from this edition' }}
      </p>
    </div>
    <button
      type="button"
      class="min-h-11 shrink-0 border border-release-seam bg-release-ink px-4 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-release-paper transition-colors hover:border-release-warning hover:text-release-warning active:border-release-paper active:bg-release-paper/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus disabled:cursor-not-allowed disabled:opacity-50"
      :aria-label="`${item.visible ? 'Hide' : 'Show'} ${item.snapshot_name}`"
      :aria-busy="visibilityPending"
      :disabled="pending"
      @click="emit('visibility', props.item.id, !props.item.visible)"
    >{{ visibilityPending ? 'Saving visibility…' : item.visible ? 'Hide' : 'Show' }}</button>
  </div>
</template>
