<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useVModel } from '@vueuse/core'
import { cn } from '@/lib/utils'

const props = defineProps<{
  defaultValue?: string | number
  modelValue?: string | number
  class?: HTMLAttributes['class']
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', payload: string | number): void
}>()

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
</script>

<template>
  <input
    v-model="modelValue"
    data-slot="input"
    :class="cn(
      'h-10 w-full min-w-0 rounded-[0.35rem] border border-release-seam bg-release-rail px-3 py-1 text-base text-[#f6f1e7] outline-none transition-[background-color,border-color,box-shadow] placeholder:text-release-paper-muted/60 hover:border-release-paper-muted/50 focus-visible:border-release-focus focus-visible:ring-2 focus-visible:ring-release-focus/30 aria-invalid:border-release-destructive aria-invalid:ring-2 aria-invalid:ring-release-destructive/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#0d0f0b] disabled:text-release-paper-muted disabled:opacity-55 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-release-paper md:text-sm',
      props.class,
    )"
  >
</template>
