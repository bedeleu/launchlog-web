<script setup lang="ts">
import type { PreviewStatus } from '~/composables/usePreviews'
import { releaseProgress } from '~/utils/release-progress'

const props = defineProps<{
  status: PreviewStatus
  hasScreenshot: boolean
  slow: boolean
  domain: string
}>()

const progress = computed(() => releaseProgress(props.status, props.hasScreenshot, props.slow))
const steps = ['Validate', 'Read', 'Capture', 'Prepare', 'Ready']
</script>

<template>
  <section
    data-preview-status
    class="border border-release-seam bg-release-rail text-release-paper"
    aria-live="polite"
    :aria-busy="status === 'generating'"
  >
    <div class="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div class="relative min-h-36 overflow-hidden border-b border-release-seam sm:aspect-[16/5] lg:border-r lg:border-b-0">
        <span aria-hidden="true" class="absolute inset-y-0 left-1/5 border-l border-release-seam" />
        <span aria-hidden="true" class="absolute inset-y-0 left-2/5 border-l border-release-seam" />
        <span aria-hidden="true" class="absolute inset-y-0 left-3/5 border-l border-release-seam" />
        <span aria-hidden="true" class="absolute inset-y-0 left-4/5 border-l border-release-seam" />
        <div class="relative flex h-full flex-col justify-between p-4 sm:p-5">
          <div class="flex items-start justify-between gap-4">
            <p class="font-mono text-[0.65rem] font-semibold tracking-[0.2em] text-release-warning uppercase">
              Private release recorder
            </p>
            <p class="max-w-[55%] truncate text-right font-mono text-[0.65rem] tracking-[0.08em] text-release-paper-muted">
              {{ domain }}
            </p>
          </div>
          <div>
            <p class="text-xl font-semibold tracking-[-0.025em] text-[#f6f1e7] sm:text-2xl">
              {{ progress.label }}
            </p>
            <p class="mt-1 max-w-xl text-sm leading-6 text-release-paper-muted">
              {{ progress.detail }}
            </p>
          </div>
        </div>
      </div>

      <ol class="grid grid-cols-5 border-release-seam lg:grid-cols-1" aria-label="Preview progress">
        <li
          v-for="(step, index) in steps"
          :key="step"
          class="flex min-w-0 items-center gap-2 border-r border-release-seam px-2 py-3 last:border-r-0 lg:border-r-0 lg:border-b lg:px-4 lg:py-2.5 lg:last:border-b-0"
          :class="index < progress.completed ? 'text-release-signal' : index === progress.completed ? 'text-release-warning' : 'text-release-paper-muted/55'"
        >
          <span class="size-1.5 shrink-0 bg-current" aria-hidden="true" />
          <span class="truncate font-mono text-[0.58rem] font-semibold tracking-[0.1em] uppercase sm:text-[0.64rem]">
            {{ step }}
          </span>
        </li>
      </ol>
    </div>
  </section>
</template>
