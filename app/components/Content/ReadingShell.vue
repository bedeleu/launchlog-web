<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  intro?: string
  label?: string
  wide?: boolean
}>(), {
  intro: '',
  label: '',
  wide: false,
})
</script>

<template>
  <div
    data-reading-shell
    class="mx-auto w-full px-5 py-12 sm:px-8 md:py-18"
    :class="wide ? 'max-w-7xl' : 'max-w-5xl'"
  >
    <header class="border-b border-release-seam pb-9 md:pb-12">
      <p
        v-if="label"
        class="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-release-blaze"
      >
        {{ label }}
      </p>
      <h1
        class="max-w-4xl text-balance text-[clamp(2.35rem,6vw,4.75rem)] font-semibold leading-[0.96] tracking-[-0.055em] text-[#f6f1e7]"
        :class="label ? 'mt-5' : ''"
      >
        {{ title }}
      </h1>
      <p v-if="intro" class="mt-6 max-w-3xl text-pretty text-lg leading-8 text-release-paper-muted md:text-xl">
        {{ intro }}
      </p>
      <div v-if="$slots.meta" class="mt-7">
        <slot name="meta" />
      </div>
    </header>

    <div class="pt-10 md:pt-14">
      <slot />
    </div>
  </div>
</template>
