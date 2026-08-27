<script setup lang="ts">
/**
 * Reserved-space message slot for forms (UX: content-jumping / reserve space).
 *
 * The slot always occupies its min-height, so showing/hiding an error never
 * shifts the surrounding layout. When there is no error it falls back to the
 * hint microcopy, so the same single line carries both states. Errors are
 * announced via role="alert" + aria-live for screen readers.
 *
 * Pass `lines` to reserve more vertical room when a message is expected to wrap.
 */
const props = withDefaults(defineProps<{
  error?: string | null
  hint?: string | null
  lines?: 1 | 2
}>(), {
  error: null,
  hint: null,
  lines: 1,
})

const minHeight = computed(() => (props.lines === 2 ? 'min-h-10' : 'min-h-5'))
</script>

<template>
  <div :class="['text-sm leading-5', minHeight]" aria-live="polite">
    <p v-if="error" class="text-release-destructive" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" class="text-release-paper-muted">
      {{ hint }}
    </p>
  </div>
</template>
