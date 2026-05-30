<script setup lang="ts">
import { RefreshCw } from '@lucide/vue'

// The ONLY spinner in the project (DRY). Always the arrows (RefreshCw) spinner —
// never a plain CSS border circle. Use <AppSpinner /> everywhere a loading
// indicator is needed.
withDefaults(defineProps<{ class?: string }>(), { class: 'size-4' })
</script>

<template>
  <RefreshCw :class="['animate-spin text-brand-accent', $props.class]" />
</template>
