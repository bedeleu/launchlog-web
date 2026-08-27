<script setup lang="ts">
import { RefreshCw } from '@lucide/vue'

// The ONLY spinner in the project (DRY). Always the arrows (RefreshCw) spinner —
// never a plain CSS border circle. Use <AppSpinner /> everywhere a loading
// indicator is needed; tune via `size` / `color`, add layout via `class`.
withDefaults(defineProps<{
  /** Tailwind size utility for the icon, e.g. 'size-4', 'size-6'. */
  size?: string
  /** Tailwind text-color utility for the stroke, e.g. 'text-current'. */
  color?: string
  /** Accessible label announced to assistive tech. */
  label?: string
  /** Extra layout classes (e.g. 'shrink-0', margins). */
  class?: string
}>(), {
  size: 'size-4',
  color: 'text-release-blaze',
  label: 'Loading',
  class: '',
})
</script>

<template>
  <RefreshCw
    role="status"
    :aria-label="label"
    :class="['animate-spin motion-reduce:animate-none', size, color, $props.class]"
  />
</template>
