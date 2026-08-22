<script setup lang="ts">
const props = withDefaults(defineProps<{
  name: string
  generating?: boolean
  /**
   * Drops the accent tint and the indigo wash. The directory Featured card is
   * deliberately monochrome, and a missing screenshot must not be the one place
   * colour comes back.
   */
  neutral?: boolean
}>(), {
  generating: false,
  neutral: false,
})

const mark = computed(() => {
  const parts = props.name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'LL'

  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase()
})
</script>

<template>
  <div class="relative flex size-full items-center justify-center overflow-hidden bg-[#111726] text-center">
    <div
      v-if="!neutral"
      class="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(99,102,241,0.24),transparent_34%),radial-gradient(circle_at_82%_76%,rgba(16,185,129,0.12),transparent_32%)]"
    />
    <div class="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:28px_28px]" />

    <div class="relative flex w-full max-w-[80%] min-w-0 flex-col items-center gap-2.5">
      <AppSpinner v-if="generating" size="size-6" label="Generating screenshot" />
      <span
        v-else
        class="flex size-11 items-center justify-center rounded-xl border font-mono text-sm font-semibold tracking-wide text-brand-fg shadow-[0_10px_32px_rgba(0,0,0,0.28)]"
        :class="neutral ? 'border-white/25 bg-white/[0.06]' : 'border-brand-accent/35 bg-brand-accent/15'"
      >
        {{ mark }}
      </span>
      <div class="w-full min-w-0">
        <p class="line-clamp-2 break-words text-sm font-medium leading-5 text-brand-fg/90">
          {{ name }}
        </p>
        <p class="mt-0.5 text-[11px] text-brand-muted">
          {{ generating ? 'Capturing website preview…' : 'Website preview coming soon' }}
        </p>
      </div>
    </div>
  </div>
</template>
