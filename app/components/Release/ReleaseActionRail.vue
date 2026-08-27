<script setup lang="ts">
withDefaults(defineProps<{
  step?: string
  title: string
  description?: string
}>(), {
  step: undefined,
  description: undefined,
})
</script>

<template>
  <section data-release-action-rail class="border border-release-seam bg-release-rail">
    <header class="border-b border-release-seam px-5 py-4">
      <p v-if="step" class="mb-2 font-mono text-[0.65rem] font-semibold tracking-[0.2em] text-release-warning uppercase">
        {{ step }}
      </p>
      <h2 class="text-lg font-semibold tracking-[-0.02em] text-[#f6f1e7]">
        {{ title }}
      </h2>
      <p v-if="description" class="mt-2 text-sm leading-6 text-release-paper-muted">
        {{ description }}
      </p>
    </header>
    <div class="space-y-4 p-5">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="border-t border-release-seam p-5">
      <slot name="footer" />
    </footer>
  </section>
</template>
