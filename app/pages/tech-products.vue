<script setup lang="ts">
import { Code2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { ListingPage } from '~/composables/useListings'

const route = useRoute()
const { listListingPage } = useListings()
const activePage = computed(() => {
  const page = Number(route.query.page || 1)
  return Number.isInteger(page) && page > 0 ? page : 1
})

const { data: pageData, error: pageError, refresh } = await useAsyncData<ListingPage>(
  () => `tech-products-${activePage.value}`,
  () => listListingPage({
    kind: 'tech',
    sort: 'priority',
    per_page: 24,
    page: activePage.value,
  }),
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

const setPage = (page: number) => navigateTo({
  path: '/tech-products',
  query: page > 1 ? { page: String(page) } : {},
})

const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const ogImageUrl = `${siteUrl}/og-image.jpg`

useSeoMeta({
  title: 'Tech products — LaunchLog',
  description: 'Developer tools, DevOps, AI/ML, APIs, no-code, and open-source launches on LaunchLog.',
  ogTitle: 'Tech products — LaunchLog',
  ogDescription: 'Developer tools, DevOps, AI/ML, APIs, no-code, and open-source launches on LaunchLog.',
  ogUrl: `${siteUrl}/tech-products`,
  ogImage: ogImageUrl,
  twitterCard: 'summary_large_image',
  twitterTitle: 'Tech products — LaunchLog',
  twitterDescription: 'Developer tools, DevOps, AI/ML, APIs, no-code, and open-source launches on LaunchLog.',
  twitterImage: ogImageUrl,
})

useBreadcrumbs([
  { name: 'Home', path: '/' },
  { name: 'Tech products', path: '/tech-products' },
])
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

    <div v-if="pageError" class="mt-16 rounded-2xl border border-red-400/20 bg-red-400/[0.05] py-16 text-center">
      <p class="text-lg font-medium text-brand-fg">Tech products are temporarily unavailable</p>
      <p class="mx-auto mt-2 max-w-sm text-brand-muted">The directory could not be loaded. Please try again.</p>
      <Button class="mt-6" variant="outline" @click="() => refresh()">Try again</Button>
    </div>

    <template v-else-if="listings.length">
      <div class="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm text-brand-muted">
        <span>Showing {{ meta.from }}–{{ meta.to }} of {{ meta.total }} tech products</span>
        <span>Page {{ meta.current_page }} of {{ meta.last_page }}</span>
      </div>
      <div class="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <ListingTile v-for="listing in listings" :key="listing.slug" :listing="listing" />
      </div>
      <nav v-if="meta.last_page > 1" class="mt-10 flex justify-center gap-2" aria-label="Tech products pagination">
        <Button variant="outline" :disabled="meta.current_page <= 1" @click="setPage(meta.current_page - 1)">
          Previous
        </Button>
        <Button variant="outline" :disabled="meta.current_page >= meta.last_page" @click="setPage(meta.current_page + 1)">
          Next
        </Button>
      </nav>
    </template>

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
