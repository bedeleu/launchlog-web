<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { ListingPage } from '~/composables/useListings'
import { parseCanonicalPageParam } from '~/utils/pagination'

const route = useRoute()
const { listListingPage } = useListings()
const parsedPage = computed(() => parseCanonicalPageParam(route.query.page))
const activePage = computed(() => parsedPage.value ?? 1)

const { data: pageData, error: pageError, refresh } = await useAsyncData<ListingPage>(
  () => `featured-listings-${activePage.value}`,
  () => listListingPage({ tier: 'featured', sort: 'priority', per_page: 24, page: activePage.value }),
  {
    default: () => ({
      data: [],
      meta: { current_page: 1, from: null, last_page: 1, per_page: 24, to: null, total: 0 },
    }),
    watch: [activePage],
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

const pageHref = (page: number) => page > 1 ? `/featured?page=${page}` : '/featured'

const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const ogImageUrl = `${siteUrl}/og-image.jpg`
const pageUrl = computed(() => `${siteUrl}${pageHref(activePage.value)}`)
const pageOutOfRange = computed(() => !pageError.value && activePage.value > meta.value.last_page)
const pageTitle = computed(() => activePage.value > 1
  ? `Featured products — Page ${activePage.value} | LaunchLog`
  : 'Featured products | LaunchLog')
const pageDescription = computed(() => activePage.value > 1
  ? `Featured products with priority placement on LaunchLog. Page ${activePage.value} of ${meta.value.last_page}.`
  : 'Featured products on LaunchLog — priority placement for selected launches.')

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
    : parsedPage.value === null
      ? 'noindex, follow'
      : undefined,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogUrl: pageUrl,
  ogImage: ogImageUrl,
  twitterCard: 'summary_large_image',
  twitterTitle: pageTitle,
  twitterDescription: pageDescription,
  twitterImage: ogImageUrl,
})

useHead(() => ({
  link: [
    { rel: 'canonical' as const, href: pageUrl.value },
    ...(parsedPage.value !== null && !pageOutOfRange.value && activePage.value > 1
      ? [{ rel: 'prev' as const, href: `${siteUrl}${pageHref(activePage.value - 1)}` }]
      : []),
    ...(parsedPage.value !== null && !pageOutOfRange.value && activePage.value < meta.value.last_page
      ? [{ rel: 'next' as const, href: `${siteUrl}${pageHref(activePage.value + 1)}` }]
      : []),
  ],
}))

useBreadcrumbs([
  { name: 'Home', path: '/' },
  { name: 'Featured', path: '/featured' },
])
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-12 lg:py-16">
    <header class="max-w-2xl">
      <!-- The same register the directory grid and the homepage strip open with:
           a label over a hairline, not a filled pill. -->
      <p class="border-b border-white/10 pb-2.5 font-mono text-xs font-medium uppercase tracking-[0.22em] text-brand-fg">
        Featured · priority placement
      </p>
      <h1 class="mt-4 text-4xl font-bold tracking-tight text-brand-fg lg:text-5xl">
        Featured products
      </h1>
      <p class="mt-3 text-lg text-brand-muted">
        Priority placement for standout launches across LaunchLog browse and category surfaces.
      </p>
    </header>

    <div v-if="pageError" class="mt-16 rounded-2xl border border-red-400/20 bg-red-400/[0.05] py-16 text-center">
      <p class="text-lg font-medium text-brand-fg">Featured products are temporarily unavailable</p>
      <p class="mx-auto mt-2 max-w-sm text-brand-muted">The directory could not be loaded. Please try again.</p>
      <Button class="mt-6" variant="outline" @click="() => refresh()">Try again</Button>
    </div>

    <template v-else-if="listings.length">
      <div class="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm text-brand-muted">
        <span>Showing {{ meta.from }}–{{ meta.to }} of {{ meta.total }} featured products</span>
        <span>Page {{ meta.current_page }} of {{ meta.last_page }}</span>
      </div>
      <ListingGrid class="mt-5" :listings="listings" mode="uniform" heading-level="h2" />
      <nav v-if="meta.last_page > 1" class="mt-10 flex justify-center gap-2" aria-label="Featured products pagination">
        <Button v-if="meta.current_page <= 1" variant="outline" disabled>
          Previous
        </Button>
        <Button v-else as-child variant="outline">
          <NuxtLink :to="pageHref(meta.current_page - 1)" rel="prev">Previous</NuxtLink>
        </Button>
        <Button v-if="meta.current_page >= meta.last_page" variant="outline" disabled>
          Next
        </Button>
        <Button v-else as-child variant="outline">
          <NuxtLink :to="pageHref(meta.current_page + 1)" rel="next">Next</NuxtLink>
        </Button>
      </nav>
    </template>

    <div v-else class="mt-16 rounded-2xl border border-brand-border bg-white/[0.02] py-20 text-center">
      <p class="text-lg font-medium text-brand-fg">
        No featured products yet
      </p>
      <p class="mx-auto mt-2 max-w-sm text-brand-muted">
        Be the first to claim a featured spot.
      </p>
      <NuxtLink
        to="/pricing"
        class="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
      >
        View pricing
      </NuxtLink>
    </div>
  </main>
</template>
