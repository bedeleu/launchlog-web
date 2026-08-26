<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { ListingPage } from '~/composables/useListings'
import { parseCanonicalPageParam } from '~/utils/pagination'

const route = useRoute()
const { listListingPage } = useListings()

// Active filters derived from the route query so deep links
// (/browse-all?category=x, ?tag=y, ?q=z) work and are SSR-safe.
const activeCategory = computed(() => (route.query.category as string) || '')
const activeTag = computed(() => (route.query.tag as string) || '')
const activeQuery = computed(() => (route.query.q as string) || '')
const parsedPage = computed(() => parseCanonicalPageParam(route.query.page))
const activePage = computed(() => parsedPage.value ?? 1)

// view=directory hands page membership to the API: it plans 30 visual slots and
// returns however many real records fill them, so no per_page is sent — a record
// count and a slot count are different pagination units and the API owns the one
// that matches this grid.
const filters = computed<Record<string, string | number>>(() => {
  const f: Record<string, string | number> = {
    view: 'directory',
    page: activePage.value,
    sort: 'priority',
  }
  if (activeCategory.value) f.category = activeCategory.value
  if (activeTag.value) f.tag = activeTag.value
  if (activeQuery.value) f.q = activeQuery.value
  return f
})

const hasFilters = computed(() => Boolean(activeCategory.value || activeTag.value || activeQuery.value))

const { data: pageData, error: pageError, refresh: refreshPage } = await useAsyncData<ListingPage>(
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

const browsePageLocation = (page: number) => {
  const target = Math.max(1, Math.min(meta.value.last_page, page))
  const query = { ...route.query }
  if (target > 1) query.page = String(target)
  else delete query.page

  return { path: '/browse-all', query }
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

const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const ogImageUrl = `${siteUrl}/og-image.jpg`
const pagePath = (page: number) => page > 1 ? `/browse-all?page=${page}` : '/browse-all'
const filteredOrInvalid = computed(() => hasFilters.value || parsedPage.value === null)
const pageOutOfRange = computed(() => !pageError.value && activePage.value > meta.value.last_page)
const canonicalUrl = computed(() => filteredOrInvalid.value
  ? `${siteUrl}/browse-all`
  : `${siteUrl}${pagePath(activePage.value)}`)
const pageTitle = computed(() => activePage.value > 1 && !filteredOrInvalid.value
  ? `Browse all SaaS launches — Page ${activePage.value} | LaunchLog`
  : 'Browse all SaaS launches | LaunchLog')
const pageDescription = computed(() => activePage.value > 1 && !filteredOrInvalid.value
  ? `Browse published SaaS and tech products on LaunchLog. Directory page ${activePage.value} of ${meta.value.last_page}.`
  : 'Browse published SaaS and tech products on LaunchLog — the log of what just shipped.')

if (import.meta.server && pageOutOfRange.value) {
  const event = useRequestEvent()
  if (event) {
    setResponseStatus(event, 404)
    useResponseHeader('X-Robots-Tag').value = 'noindex, nofollow'
  }
}

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  robots: () => pageOutOfRange.value
    ? 'noindex, nofollow'
    : filteredOrInvalid.value
      ? 'noindex, follow'
      : undefined,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogUrl: canonicalUrl,
  ogImage: ogImageUrl,
  twitterCard: 'summary_large_image',
  twitterTitle: pageTitle,
  twitterDescription: pageDescription,
  twitterImage: ogImageUrl,
})

useHead(() => ({
  link: [
    { rel: 'canonical' as const, href: canonicalUrl.value },
    ...(!filteredOrInvalid.value && !pageOutOfRange.value && activePage.value > 1
      ? [{ rel: 'prev' as const, href: `${siteUrl}${pagePath(activePage.value - 1)}` }]
      : []),
    ...(!filteredOrInvalid.value && !pageOutOfRange.value && activePage.value < meta.value.last_page
      ? [{ rel: 'next' as const, href: `${siteUrl}${pagePath(activePage.value + 1)}` }]
      : []),
  ],
}))

useBreadcrumbs([
  { name: 'Home', path: '/' },
  { name: 'Browse all', path: '/browse-all' },
])
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
            class="h-11 w-full rounded-md border border-brand-border bg-white/[0.02] pl-9 pr-3 text-sm text-brand-fg outline-none transition-colors placeholder:text-brand-muted focus:border-brand-accent/50"
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
    <div v-if="pageError" class="mt-16 rounded-2xl border border-red-400/20 bg-red-400/[0.05] py-16 text-center">
      <p class="text-lg font-medium text-brand-fg">
        Listings are temporarily unavailable
      </p>
      <p class="mx-auto mt-2 max-w-sm text-brand-muted">
        The directory could not be loaded. Please try again.
      </p>
      <Button class="mt-6" variant="outline" @click="() => refreshPage()">
        Try again
      </Button>
    </div>

    <template v-else-if="listings.length">
      <div class="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-brand-muted">
        <span>
          Showing {{ meta.from }}–{{ meta.to }} of {{ meta.total }} products
        </span>
        <span>
          Page {{ meta.current_page }} of {{ meta.last_page }}
        </span>
      </div>

      <!-- Mixed on every numeric page: the API plans slots for all of them, and a
           page that happens to hold only Basic listings renders as the ordinary
           three-column grid anyway. -->
      <ListingGrid
        class="mt-5"
        :listings="listings"
        mode="mixed"
        heading-level="h2"
      />

      <nav
        v-if="meta.last_page > 1"
        class="mt-10 flex flex-wrap items-center justify-center gap-2"
        aria-label="Browse pagination"
      >
        <Button v-if="meta.current_page <= 1" variant="outline" disabled>
          Previous
        </Button>
        <Button v-else as-child variant="outline">
          <NuxtLink :to="browsePageLocation(meta.current_page - 1)" rel="prev">
            Previous
          </NuxtLink>
        </Button>
        <template v-for="(page, index) in pageNumbers" :key="page">
          <span
            v-if="index > 0 && pageNumbers[index - 1] !== page - 1"
            class="px-1 text-sm text-brand-muted"
            aria-hidden="true"
          >
            …
          </span>
          <span
            v-if="page === meta.current_page"
            class="flex size-10 items-center justify-center rounded-md border text-sm font-medium transition-colors"
            :class="'border-emerald-400 bg-emerald-400 text-slate-950'"
            aria-current="page"
          >
            {{ page }}
          </span>
          <NuxtLink
            v-else
            :to="browsePageLocation(page)"
            class="flex size-10 items-center justify-center rounded-md border border-brand-border text-sm font-medium text-brand-muted transition-colors hover:border-white/20 hover:text-brand-fg"
          >
            {{ page }}
          </NuxtLink>
        </template>
        <Button v-if="meta.current_page >= meta.last_page" variant="outline" disabled>
          Next
        </Button>
        <Button v-else as-child variant="outline">
          <NuxtLink :to="browsePageLocation(meta.current_page + 1)" rel="next">
            Next
          </NuxtLink>
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
