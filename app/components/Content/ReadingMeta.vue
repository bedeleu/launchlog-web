<script setup lang="ts">
interface ReadingMetaItem {
  label: string
  value: string
  datetime?: string
}

defineProps<{
  items: ReadingMetaItem[]
}>()
</script>

<template>
  <dl class="flex flex-wrap gap-x-7 gap-y-3 font-mono text-[11px] uppercase tracking-[0.14em]">
    <div v-for="item in items" :key="`${item.label}-${item.value}`" class="flex items-baseline gap-2">
      <dt class="text-release-paper-muted">{{ item.label }}</dt>
      <dd class="text-[#f6f1e7]">
        <time v-if="item.datetime" :datetime="item.datetime">{{ item.value }}</time>
        <template v-else>{{ item.value }}</template>
      </dd>
    </div>
  </dl>
</template>
