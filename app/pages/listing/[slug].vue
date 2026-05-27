<script setup lang="ts">
const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))
useSeoMeta({ title: () => `${slug.value} | LaunchLog` })
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-16">
    <h1 class="text-4xl font-bold">
      {{ slug }}
    </h1>
    <p class="text-brand-muted mt-4">
      Coming soon. Listing detail page (schema.org graph + markdown negotiation lands in Phase 3).
    </p>
  </main>
</template>
