<script setup lang="ts">
const props = defineProps<{
  name: string
  generating?: boolean
}>()

const mark = computed(() => {
  const parts = props.name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'LL'

  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase()
})
</script>

<template>
  <!-- Blank catalog stock. It borrows ReleaseCover's empty-state vocabulary —
       two perforated register rules and one mono line naming the capture state —
       so a missing screenshot reads as an unprinted cover rather than as a
       broken card. No colour wash: a missing capture is never where colour
       returns to the directory. -->
  <div class="relative flex size-full items-center justify-center overflow-hidden bg-release-ink text-center">
    <span aria-hidden="true" class="absolute inset-y-0 left-1/3 border-l border-dashed border-release-seam" />
    <span aria-hidden="true" class="absolute inset-y-0 right-1/3 border-r border-dashed border-release-seam" />

    <div class="relative flex w-full min-w-0 max-w-[80%] flex-col items-center gap-2.5">
      <AppSpinner v-if="generating" size="size-6" label="Generating screenshot" />
      <span
        v-else
        class="flex size-11 items-center justify-center border border-release-seam bg-release-rail font-mono text-sm font-semibold tracking-[0.08em] text-release-paper"
      >
        {{ mark }}
      </span>
      <div class="w-full min-w-0">
        <p class="line-clamp-2 break-words text-sm font-medium leading-5 text-release-paper">
          {{ name }}
        </p>
        <p class="mt-1 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-release-paper-muted">
          {{ generating ? 'Capture in progress' : 'Website capture unavailable' }}
        </p>
      </div>
    </div>
  </div>
</template>
