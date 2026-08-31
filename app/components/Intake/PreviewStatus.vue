<script setup lang="ts">
import type { PreviewStatus } from '~/composables/usePreviews'
import { releaseProgress, type ReleaseProgressStep } from '~/utils/release-progress'

const props = defineProps<{
  status: PreviewStatus
  hasScreenshot: boolean
  slow: boolean
  domain: string
}>()

const progress = computed(() => releaseProgress(props.status, props.hasScreenshot, props.slow))
type RecorderStep = Exclude<ReleaseProgressStep, 'blocked'>

const steps = [
  { key: 'validate', label: 'Validate' },
  { key: 'read', label: 'Read' },
  { key: 'capture', label: 'Capture' },
  { key: 'prepare', label: 'Prepare' },
  { key: 'ready', label: 'Ready' },
] as const satisfies ReadonlyArray<{ key: RecorderStep, label: string }>

const activeStepIndex = computed(() => steps.findIndex(step => step.key === progress.value.step))

const stepStateLabel = (index: number, key: RecorderStep) => {
  if (key === progress.value.step) return 'Current'
  if (activeStepIndex.value >= 0 && index < activeStepIndex.value) return 'Complete'
  return 'Queued'
}
</script>

<template>
  <section
    data-preview-status
    class="border border-release-seam bg-release-rail text-release-paper"
    :aria-busy="status === 'generating'"
  >
    <div class="grid lg:grid-cols-[minmax(20rem,0.85fr)_minmax(32rem,1.7fr)]">
      <div class="border-b border-release-seam px-4 py-4 sm:px-5 lg:border-r lg:border-b-0">
        <div class="flex items-start justify-between gap-4">
          <p class="font-mono text-[0.65rem] font-semibold tracking-[0.2em] text-release-warning uppercase">
            Private release recorder
          </p>
          <p
            class="max-w-[48%] truncate text-right font-mono text-[0.65rem] tracking-[0.08em] text-release-paper-muted"
            :title="domain"
          >
            {{ domain }}
          </p>
        </div>
        <div
          data-preview-status-summary
          class="mt-3 min-w-0"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div class="flex flex-col gap-0.5 xl:flex-row xl:items-baseline xl:gap-3">
            <p class="shrink-0 text-lg font-semibold tracking-[-0.025em] text-[#f6f1e7]">
              {{ progress.label }}
            </p>
            <p class="min-w-0 text-sm leading-5 text-release-paper-muted">
              {{ progress.detail }}
            </p>
          </div>
        </div>
      </div>

      <ol
        data-preview-status-steps
        class="grid grid-cols-5 divide-x divide-release-seam"
        aria-label="Preview progress"
      >
        <li
          v-for="(step, index) in steps"
          :key="step.key"
          class="flex min-w-0 flex-col justify-center gap-1 px-1 py-3 min-[360px]:px-2 sm:px-3 lg:py-4"
          :class="step.key === progress.step
            ? 'bg-release-warning/[0.06] text-release-warning'
            : activeStepIndex >= 0 && index < activeStepIndex
              ? 'text-release-signal'
              : 'text-release-paper-muted/55'"
          :aria-current="step.key === progress.step ? 'step' : undefined"
        >
          <span class="flex min-w-0 items-center sm:gap-1.5">
            <span class="hidden size-1.5 shrink-0 bg-current sm:block" aria-hidden="true" />
            <span class="font-mono text-[0.55rem] font-semibold tracking-[0.04em] uppercase sm:text-[0.62rem] sm:tracking-[0.08em]">
              {{ step.label }}
            </span>
          </span>
          <span class="font-mono text-[0.48rem] tracking-[0.03em] uppercase opacity-80 sm:pl-3 sm:text-[0.55rem] sm:tracking-[0.06em]">
            {{ stepStateLabel(index, step.key) }}
          </span>
        </li>
      </ol>
    </div>
  </section>
</template>
