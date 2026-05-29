<script setup lang="ts">
import { Code2 } from '@lucide/vue'
import type { ListingCard } from '~/composables/useListings'

const { listListings } = useListings()

// "Tech products" = listings in tech-leaning categories. The list API has no
// multi-category param, so we fetch the (featured-first) published list once
// and filter client-side. Order is preserved → featured-first feel kept.
const TECH_CATEGORIES = new Set([
  'developer-tools',
  'devops',
  'ai-ml',
  'apis',
  'no-code',
  'open-source',
])

const { data: all } = await useAsyncData<ListingCard[]>(
  'tech-products-source',
  () => listListings(),
  { default: () => [] },
)

const listings = computed(() =>
  (all.value ?? []).filter(l => l.category && TECH_CATEGORIES.has(l.category.slug)),
)

useSeoMeta({
  title: 'Tech products — LaunchLog',
  description: 'Developer tools, DevOps, AI/ML, APIs, no-code, and open-source launches on LaunchLog.',
})
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-12 lg:py-16">
    <header class="max-w-2xl">
      <span class="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-white/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-fg">
        <Code2 class="size-3.5" />
        Tech
      </span>
      <h1 class="mt-4 text-4xl font-bold tracking-tight text-brand-fg lg:text-5xl">
        Tech products
      </h1>
      <p class="mt-3 text-lg text-brand-muted">
        Developer tools, DevOps, AI/ML, APIs, no-code, and open-source — the launches builders care about.
      </p>
    </header>

    <!-- Grid -->
    <div
      v-if="listings.length"
      class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      <ListingTile
        v-for="listing in listings"
        :key="listing.slug"
        :listing="listing"
      />
    </div>

    <!-- Empty state -->
    <div v-else class="mt-16 rounded-2xl border border-brand-border bg-white/[0.02] py-20 text-center">
      <p class="text-lg font-medium text-brand-fg">
        No tech products yet
      </p>
      <p class="mx-auto mt-2 max-w-sm text-brand-muted">
        Check back soon, or browse everything that just shipped.
      </p>
      <NuxtLink
        to="/browse-all"
        class="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
      >
        Browse all
      </NuxtLink>
    </div>
  </main>
</template>
