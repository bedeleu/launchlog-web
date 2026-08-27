<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  value?: string
  tone?: 'blaze' | 'signal' | 'paper'
}>(), {
  value: undefined,
  tone: 'blaze',
})

const toneClass = computed(() => ({
  blaze: 'border-release-blaze bg-release-blaze text-release-ink',
  signal: 'border-release-signal bg-release-signal text-release-ink',
  paper: 'border-release-paper bg-release-paper text-release-ink',
})[props.tone])
</script>

<template>
  <div
    data-release-evidence-band
    :class="['flex min-h-12 items-center justify-between gap-4 border px-4 py-2.5 font-mono text-[0.68rem] font-semibold tracking-[0.16em] uppercase', toneClass]"
  >
    <span>{{ label }}</span>
    <span v-if="value" class="min-w-0 truncate text-right tracking-[0.08em]">
      {{ value }}
    </span>
    <slot />
  </div>
</template>
