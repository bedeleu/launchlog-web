<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  <ReleaseShell
    eyebrow="Catalog · all releases"
    title="Browse all"
    description="Every product on LaunchLog — the log of what just shipped."
  >
    <!-- The reading filters sit above the sheet on their own register, so the
         catalog below them starts on a clean rule. -->
    <div class="space-y-4 border-b border-release-seam pb-6">
      <form class="flex max-w-md items-center gap-2" @submit.prevent="submitSearch">
        <div class="relative flex-1">
          <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-release-paper-muted" />
          <Input
            v-model="search"
            type="search"
            aria-label="Search products"
            placeholder="Search products…"
            class="h-11 pl-9"
          />
        </div>
        <Button type="submit" variant="outline" size="lg">
          Search
        </Button>
      </form>

      <div class="flex flex-wrap items-center gap-2">
        <!-- Category chips are the catalog's own register type: the selected
             chip inverts to paper rather than lighting up in an accent the
             directory reserves for action. -->
        <Button
          type="button"
          size="sm"
          :variant="!activeCategory ? 'default' : 'outline'"
          class="font-mono text-[0.68rem] tracking-[0.14em] uppercase"
          @click="setCategory('')"
        >
          All
        </Button>
        <Button
          v-for="cat in categories"
          :key="cat.slug"
          type="button"
          size="sm"
          :variant="activeCategory === cat.slug ? 'default' : 'outline'"
          class="font-mono text-[0.68rem] tracking-[0.14em] uppercase"
          @click="setCategory(cat.slug)"
        >
          {{ cat.name }}
        </Button>

        <!-- Clear filters sits inline with the chips so toggling a filter never
             pushes a new row in and grows the layout. -->
        <Button
          v-if="hasFilters"
          type="button"
          size="sm"
          variant="link"
          class="font-mono text-[0.68rem] tracking-[0.14em] uppercase"
          @click="clearFilters"
        >
          <X class="size-3.5" /> Clear filters
        </Button>
      </div>
    </div>

    <div
      v-if="pageError"
      class="mt-8 border border-release-destructive/40 bg-release-destructive/10 px-6 py-14 text-center"
    >
      <p class="text-lg font-medium text-[#f6f1e7]">
        Listings are temporarily unavailable
      </p>
      <p class="mx-auto mt-2 max-w-sm text-release-paper-muted">
        The directory could not be loaded. Please try again.
      </p>
      <Button class="mt-6" variant="outline" @click="() => refreshPage()">
        Try again
      </Button>
    </div>

    <template v-else-if="listings.length">
      <!-- The sheet's own register: a slot-aware page returns a variable record
           count, so the range and the page position are stated, not implied. -->
      <div class="mt-7 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-release-seam pb-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-release-paper-muted">
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
        class="mt-7"
        :listings="listings"
        mode="mixed"
        heading-level="h2"
      />

      <ListingPagination
        :current-page="meta.current_page"
        :last-page="meta.last_page"
        :pages="pageNumbers"
        :to="browsePageLocation"
        label="Browse pagination"
      />
    </template>

    <div v-else class="mt-8 border border-release-seam bg-release-rail px-6 py-16 text-center">
      <p class="text-lg font-medium text-[#f6f1e7]">
        No listings match
      </p>
      <p class="mx-auto mt-2 max-w-sm text-release-paper-muted">
        Try a different category or search term.
      </p>
      <Button
        v-if="hasFilters"
        class="mt-6"
        variant="outline"
        @click="clearFilters"
      >
        <X class="size-4" /> Clear filters
      </Button>
    </div>
  </ReleaseShell>
</template>
