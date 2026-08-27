<script setup lang="ts">
withDefaults(defineProps<{
  eyebrow?: string
  title: string
  description?: string
  compact?: boolean
}>(), {
  eyebrow: undefined,
  description: undefined,
  compact: false,
})
</script>

<template>
  <section
    data-release-shell
    :class="[
      'mx-auto w-full max-w-[96rem] border-x border-release-seam bg-release-ink text-[#f6f1e7]',
      compact ? 'px-4 py-6 sm:px-6' : 'px-4 py-8 sm:px-8 lg:px-12 lg:py-12',
    ]"
  >
    <header class="mb-7 max-w-4xl border-b border-release-seam pb-6 lg:mb-9">
      <p
        v-if="eyebrow"
        class="mb-3 font-mono text-[0.68rem] font-semibold tracking-[0.22em] text-release-blaze uppercase"
      >
        {{ eyebrow }}
      </p>
      <h1 class="max-w-[22ch] text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl lg:text-5xl">
        <slot name="title">
          {{ title }}
        </slot>
      </h1>
      <p v-if="description" class="mt-4 max-w-2xl text-base leading-7 text-release-paper-muted">
        {{ description }}
      </p>
    </header>

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
      <div data-release-main class="min-w-0">
        <slot />
      </div>
      <aside v-if="$slots.rail" data-release-rail class="min-w-0 lg:sticky lg:top-24">
        <slot name="rail" />
      </aside>
    </div>
  </section>
</template>
