<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { ListingPage } from '~/composables/useListings'

const route = useRoute()
const { listListingPage } = useListings()

// Active filters derived from the route query so deep links
// (/browse-all?category=x, ?tag=y, ?q=z) work and are SSR-safe.
const activeCategory = computed(() => (route.query.category as string) || '')
const activeTag = computed(() => (route.query.tag as string) || '')
const activeQuery = computed(() => (route.query.q as string) || '')
const activePage = computed(() => {
  const page = Number(route.query.page || 1)
  return Number.isInteger(page) && page > 0 ? page : 1
})

const filters = computed<Record<string, string | number>>(() => {
  const f: Record<string, string | number> = { page: activePage.value }
  if (activeCategory.value) f.category = activeCategory.value
  if (activeTag.value) f.tag = activeTag.value
  if (activeQuery.value) f.q = activeQuery.value
  return f
})

const hasFilters = computed(() => Boolean(activeCategory.value || activeTag.value || activeQuery.value))

const { data: pageData } = await useAsyncData<ListingPage>(
  () => `browse-${JSON.stringify(filters.value)}`,
  () => listListingPage(filters.value),
  {
    default: () => ({
      data: [],
      meta: {
        current_page: 1,
        from: null,
        last_page: 1,
        per_page: 24,
        to: null,
        total: 0,
      },
    }),
    watch: [filters],
  },
)

const listings = computed(() => pageData.value?.data ?? [])
const meta = computed(() => pageData.value?.meta ?? {
  current_page: 1,
  from: null,
  last_page: 1,
  per_page: 24,
  to: null,
  total: 0,
})

const categories = [
  { slug: 'saas', name: 'SaaS' },
  { slug: 'marketing', name: 'Marketing' },
  { slug: 'ai-ml', name: 'AI & ML' },
  { slug: 'developer-tools', name: 'Developer Tools' },
  { slug: 'productivity', name: 'Productivity' },
  { slug: 'design', name: 'Design' },
  { slug: 'analytics', name: 'Analytics' },
  { slug: 'fintech', name: 'Fintech' },
]

const setCategory = (slug: string) => {
  const query: Record<string, string> = { ...route.query as Record<string, string> }
  if (slug && slug !== activeCategory.value) query.category = slug
  else delete query.category
  delete query.page
  navigateTo({ path: '/browse-all', query })
}

const search = ref(activeQuery.value)
watch(activeQuery, v => (search.value = v))

const submitSearch = () => {
  const query: Record<string, string> = { ...route.query as Record<string, string> }
  const q = search.value.trim()
  if (q) query.q = q
  else delete query.q
  delete query.page
  navigateTo({ path: '/browse-all', query })
}

const clearFilters = () => navigateTo({ path: '/browse-all', query: {} })

const setPage = (page: number) => {
  const target = Math.max(1, Math.min(meta.value.last_page, page))
  const query: Record<string, string> = { ...route.query as Record<string, string> }
  if (target > 1) query.page = String(target)
  else delete query.page
  navigateTo({ path: '/browse-all', query })
}

const pageNumbers = computed(() => {
  const last = meta.value.last_page
  const current = meta.value.current_page
  const start = Math.max(1, current - 2)
  const end = Math.min(last, current + 2)
  const pages = new Set<number>([1, last])
  for (let page = start; page <= end; page++) pages.add(page)
  return [...pages].sort((a, b) => a - b)
})

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

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-sm transition-colors"
          :class="!activeCategory
            ? 'border-emerald-400/45 bg-emerald-400/10 text-emerald-300'
            : 'border-brand-border text-brand-muted hover:border-white/20 hover:text-brand-fg'"
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
            ? 'border-emerald-400/45 bg-emerald-400/10 text-emerald-300'
            : 'border-brand-border text-brand-muted hover:border-white/20 hover:text-brand-fg'"
          @click="setCategory(cat.slug)"
        >
          {{ cat.name }}
        </button>

        <!-- Clear filters sits inline with the pills so toggling a filter never
             pushes a new row in and grows the layout. -->
        <button
          v-if="hasFilters"
          type="button"
          class="ml-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm text-emerald-300 transition-colors hover:text-brand-fg"
          @click="clearFilters"
        >
          <X class="size-3.5" /> Clear filters
        </button>
      </div>
    </div>

    <!-- Grid -->
    <template v-if="listings.length">
      <div class="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-brand-muted">
        <span>
          Showing {{ meta.from }}–{{ meta.to }} of {{ meta.total }} products
        </span>
        <span>
          Page {{ meta.current_page }} of {{ meta.last_page }}
        </span>
      </div>

      <div class="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <ListingTile
          v-for="listing in listings"
          :key="listing.slug"
          :listing="listing"
        />
      </div>

      <nav
        v-if="meta.last_page > 1"
        class="mt-10 flex flex-wrap items-center justify-center gap-2"
        aria-label="Browse pagination"
      >
        <Button
          variant="outline"
          :disabled="meta.current_page <= 1"
          @click="setPage(meta.current_page - 1)"
        >
          Previous
        </Button>
        <template v-for="(page, index) in pageNumbers" :key="page">
          <span
            v-if="index > 0 && pageNumbers[index - 1] !== page - 1"
            class="px-1 text-sm text-brand-muted"
            aria-hidden="true"
          >
            …
          </span>
          <button
            type="button"
            class="flex size-10 items-center justify-center rounded-md border text-sm font-medium transition-colors"
            :class="page === meta.current_page
              ? 'border-emerald-400 bg-emerald-400 text-slate-950'
              : 'border-brand-border text-brand-muted hover:border-white/20 hover:text-brand-fg'"
            :aria-current="page === meta.current_page ? 'page' : undefined"
            @click="setPage(page)"
          >
            {{ page }}
          </button>
        </template>
        <Button
          variant="outline"
          :disabled="meta.current_page >= meta.last_page"
          @click="setPage(meta.current_page + 1)"
        >
          Next
        </Button>
      </nav>
    </template>

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
        class="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300 transition-colors hover:text-brand-fg"
        @click="clearFilters"
      >
        <X class="size-4" /> Clear filters
      </button>
    </div>
  </main>
</template>
