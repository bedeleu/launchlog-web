<script setup lang="ts">
defineProps<{ title: string, message: string, pending?: boolean }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <section
    class="border border-release-seam border-l-2 border-l-release-destructive bg-release-rail p-6 text-center text-release-paper"
  >
    <div role="alert" aria-atomic="true">
      <h2 class="text-lg font-semibold text-release-destructive">
        {{ title }}
      </h2>
      <p class="mx-auto mt-2 max-w-xl text-sm leading-6 text-release-paper-muted">
        {{ message }}
      </p>
    </div>
    <button
      type="button"
      class="release-action mt-5 active:bg-release-paper-muted"
      :disabled="pending"
      :aria-busy="pending || undefined"
      @click="$emit('retry')"
    >
      <AppSpinner v-if="pending" color="text-current" label="Retrying" />
      {{ pending ? 'Trying again…' : 'Try again' }}
    </button>
  </section>
</template>
