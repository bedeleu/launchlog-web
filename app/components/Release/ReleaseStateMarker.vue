<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  detail?: string
  state?: 'neutral' | 'active' | 'success' | 'warning' | 'destructive'
  live?: boolean
}>(), {
  detail: undefined,
  state: 'neutral',
  live: false,
})

const stateClass = computed(() => ({
  neutral: 'border-release-seam text-release-paper-muted',
  active: 'border-release-warning text-release-warning',
  success: 'border-release-signal text-release-signal',
  warning: 'border-release-warning text-release-warning',
  destructive: 'border-release-destructive text-release-destructive',
})[props.state])
</script>

<template>
  <div
    data-release-state
    :data-state="state"
    :aria-live="live ? 'polite' : undefined"
    :class="['flex items-start gap-3 border-l-2 py-1 pl-3', stateClass]"
  >
    <span aria-hidden="true" class="mt-1.5 size-1.5 shrink-0 bg-current" />
    <span class="min-w-0">
      <span class="block font-mono text-[0.68rem] font-semibold tracking-[0.14em] uppercase">{{ label }}</span>
      <span v-if="detail" class="mt-1 block text-sm leading-5 text-release-paper-muted">{{ detail }}</span>
    </span>
  </div>
</template>
