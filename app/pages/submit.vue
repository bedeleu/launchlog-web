<script setup lang="ts">
useSeoMeta({ title: 'Submit your product | LaunchLog' })
</script>

<template>
  <main class="mx-auto max-w-3xl px-6 py-24">
    <h1 class="text-4xl font-bold text-brand-fg">
      Submit your product
    </h1>
    <p class="text-brand-muted mt-3">
      Drop your URL — we'll generate a free preview before you pay a cent.
    </p>
    <div class="mt-8">
      <IntakePreviewForm />
    </div>
  </main>
</template>
