<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { ListingCard } from '~/composables/useListings'

const route = useRoute()
const { listListings } = useListings()

// Active filters derived from the route query so deep links
// (/browse-all?category=x, ?tag=y, ?q=z) work and are SSR-safe.
const activeCategory = computed(() => (route.query.category as string) || '')
const activeTag = computed(() => (route.query.tag as string) || '')
const activeQuery = computed(() => (route.query.q as string) || '')

const filters = computed<Record<string, string>>(() => {
  const f: Record<string, string> = {}
  if (activeCategory.value) f.category = activeCategory.value
  if (activeTag.value) f.tag = activeTag.value
  if (activeQuery.value) f.q = activeQuery.value
  return f
})

const hasFilters = computed(() => Object.keys(filters.value).length > 0)

const { data: listings } = await useAsyncData<ListingCard[]>(
  () => `browse-${JSON.stringify(filters.value)}`,
  () => listListings(filters.value),
  { default: () => [], watch: [filters] },
)

// Category chips: derived from the listings actually returned, so the
// affordance never offers an empty filter. Featured-first ordering preserved.
const categories = computed(() => {
  const seen = new Map<string, string>()
  for (const l of listings.value ?? []) {
    if (l.category && !seen.has(l.category.slug)) seen.set(l.category.slug, l.category.name)
  }
  return [...seen.entries()].map(([slug, name]) => ({ slug, name }))
})

const setCategory = (slug: string) => {
  const query: Record<string, string> = { ...route.query as Record<string, string> }
  if (slug && slug !== activeCategory.value) query.category = slug
  else delete query.category
  navigateTo({ path: '/browse-all', query })
}

const search = ref(activeQuery.value)
watch(activeQuery, v => (search.value = v))

const submitSearch = () => {
  const query: Record<string, string> = { ...route.query as Record<string, string> }
  const q = search.value.trim()
  if (q) query.q = q
  else delete query.q
  navigateTo({ path: '/browse-all', query })
}

const clearFilters = () => navigateTo({ path: '/browse-all', query: {} })

useSeoMeta({
  title: 'Browse all — LaunchLog',
  description: 'Browse every product on LaunchLog — the log of what just shipped.',
})
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-12 lg:py-16">
    <header class="max-w-2xl">
      <h1 class="text-4xl font-bold tracking-tight text-brand-fg lg:text-5xl">
        Browse all
      </h1>
      <p class="mt-3 text-lg text-brand-muted">
        Every product on LaunchLog — the log of what just shipped.
      </p>
    </header>

    <!-- Filters -->
    <div class="mt-8 space-y-4">
      <form class="flex max-w-md items-center gap-2" @submit.prevent="submitSearch">
        <div class="relative flex-1">
          <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-muted" />
          <input
            v-model="search"
            type="search"
            placeholder="Search products…"
            class="h-10 w-full rounded-md border border-brand-border bg-white/[0.02] pl-9 pr-3 text-sm text-brand-fg outline-none transition-colors placeholder:text-brand-muted focus:border-brand-accent/50"
          >
        </div>
        <Button type="submit" variant="outline" size="lg">
          Search
        </Button>
      </form>

      <div v-if="categories.length" class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-sm transition-colors"
          :class="!activeCategory
            ? 'border-brand-accent/50 bg-brand-accent/10 text-brand-accent'
            : 'border-brand-border text-brand-muted hover:text-brand-fg'"
          @click="setCategory('')"
        >
          All
        </button>
        <button
          v-for="cat in categories"
          :key="cat.slug"
          type="button"
          class="rounded-full border px-3 py-1 text-sm transition-colors"
          :class="activeCategory === cat.slug
            ? 'border-brand-accent/50 bg-brand-accent/10 text-brand-accent'
            : 'border-brand-border text-brand-muted hover:text-brand-fg'"
          @click="setCategory(cat.slug)"
        >
          {{ cat.name }}
        </button>
      </div>

      <div v-if="hasFilters" class="flex flex-wrap items-center gap-2 text-sm text-brand-muted">
        <span v-if="activeTag">Tag: <span class="text-brand-fg">{{ activeTag }}</span></span>
        <button
          type="button"
          class="inline-flex items-center gap-1 text-brand-accent transition-colors hover:text-brand-fg"
          @click="clearFilters"
        >
          <X class="size-3.5" /> Clear filters
        </button>
      </div>
    </div>

    <!-- Grid -->
    <div
      v-if="listings && listings.length"
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
        No listings match
      </p>
      <p class="mx-auto mt-2 max-w-sm text-brand-muted">
        Try a different category or search term.
      </p>
      <button
        v-if="hasFilters"
        type="button"
        class="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-accent transition-colors hover:text-brand-fg"
        @click="clearFilters"
      >
        <X class="size-4" /> Clear filters
      </button>
    </div>
  </main>
</template>
