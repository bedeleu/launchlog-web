<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { ListingCard } from '~/composables/useListings'
import { takeListingsWithoutSlugs } from '~/utils/listing-placement'

const { user } = useAuth()
const { listListings } = useListings()

interface HomeListings {
  featured: ListingCard[]
  recent: ListingCard[]
}

const HOMEPAGE_FEATURED_SLOTS = 3
const HOMEPAGE_RECENT_SLOTS = 6

const { data: homeListings, error: homeListingsError, refresh: refreshHomeListings } = await useAsyncData<HomeListings>(
  'home-directory-listings',
  async () => {
    const [featured, recent] = await Promise.all([
      listListings({ tier: 'featured', sort: 'priority', per_page: HOMEPAGE_FEATURED_SLOTS }),
      // Over-fetch: the featured slugs are removed below, and asking for exactly
      // six would leave the recent row short whenever they overlap.
      listListings({ sort: 'recent', per_page: HOMEPAGE_RECENT_SLOTS + HOMEPAGE_FEATURED_SLOTS }),
    ])

    return { featured, recent }
  },
  { default: () => ({ featured: [], recent: [] }) },
)

const featuredListings = computed(() => homeListings.value?.featured ?? [])

const recentListings = computed(() => takeListingsWithoutSlugs(
  homeListings.value?.recent ?? [],
  new Set(featuredListings.value.map(listing => listing.slug)),
  HOMEPAGE_RECENT_SLOTS,
))

// A failed fetch used to fall through to the empty default, which removed the
// paid Homepage Featured section with no signal at all.
if (import.meta.server && homeListingsError.value) {
  console.error('[home] directory listings failed to load', homeListingsError.value)
}

const homeListingsFailed = computed(() =>
  Boolean(homeListingsError.value) && !featuredListings.value.length && !recentListings.value.length)

const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const homeUrl = `${siteUrl}/`
const ogImageUrl = `${siteUrl}/og-image.jpg`
const homeDescription = 'LaunchLog is a curated directory for indie makers, SaaS founders and tech launches, built for discoverability in Google, Bing and AI answer engines.'

useSeoMeta({
  title: 'LaunchLog — The log of what just shipped',
  description: homeDescription,
  ogTitle: 'LaunchLog — The log of what just shipped',
  ogDescription: homeDescription,
  ogUrl: homeUrl,
  ogImage: ogImageUrl,
  ogImageSecureUrl: ogImageUrl,
  ogImageAlt: 'LaunchLog — The log of what just shipped',
  twitterTitle: 'LaunchLog — The log of what just shipped',
  twitterDescription: homeDescription,
  twitterImage: ogImageUrl,
  twitterImageAlt: 'LaunchLog — The log of what just shipped',
})

useHead({
  script: [
    {
      key: 'launchlog-home-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': `${siteUrl}/#organization`,
            name: 'LaunchLog',
            url: homeUrl,
            description:
              'LaunchLog is a curated paid directory for indie makers, SaaS founders and tech launches.',
            slogan: 'The log of what just shipped.',
            foundingDate: '2026',
            areaServed: 'Worldwide',
            knowsAbout: [
              'SaaS launches',
              'indie maker products',
              'AI search visibility',
              'schema.org',
              'llms.txt',
              'product directories',
            ],
            logo: {
              '@type': 'ImageObject',
              url: ogImageUrl,
              width: 1200,
              height: 630,
            },
            image: ogImageUrl,
            sameAs: [],
          },
          {
            '@type': 'WebSite',
            '@id': `${siteUrl}/#website`,
            name: 'LaunchLog',
            url: homeUrl,
            publisher: {
              '@id': `${siteUrl}/#organization`,
            },
            description: homeDescription,
            inLanguage: 'en-US',
            availableLanguage: ['English'],
            potentialAction: {
              '@type': 'SearchAction',
              target: `${siteUrl}/browse-all?q={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          },
          {
            '@type': 'WebPage',
            '@id': `${siteUrl}/#webpage`,
            url: homeUrl,
            name: 'LaunchLog — The log of what just shipped',
            description: homeDescription,
            inLanguage: 'en-US',
            primaryImageOfPage: {
              '@type': 'ImageObject',
              url: ogImageUrl,
              width: 1200,
              height: 630,
            },
            isPartOf: {
              '@id': `${siteUrl}/#website`,
            },
            about: {
              '@id': `${siteUrl}/#organization`,
            },
          },
          {
            '@type': 'WebApplication',
            '@id': `${siteUrl}/#software`,
            name: 'LaunchLog',
            url: homeUrl,
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description:
              'A curated paid directory for indie makers, SaaS founders and tech launches, with schema.org structured data and AI-readable pages on every listing.',
            provider: { '@id': `${siteUrl}/#organization` },
            image: ogImageUrl,
            offers: [
              { '@type': 'Offer', name: 'Basic', price: '24.99', priceCurrency: 'USD' },
              { '@type': 'Offer', name: 'Premium', price: '59.99', priceCurrency: 'USD' },
              { '@type': 'Offer', name: 'Featured', price: '99.00', priceCurrency: 'USD' },
            ],
          },
        ],
      }),
    },
  ],
})
</script>

<template>
  <main class="min-h-screen">
    <section class="mx-auto flex max-w-6xl flex-col justify-center px-6 py-16">
      <p class="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
        Curated directory for indie tech
      </p>
      <h1 class="mt-6 max-w-3xl text-5xl font-bold tracking-normal text-brand-fg md:text-7xl">
        Get Listed.
        <span class="block text-brand-muted">Get Found.</span>
      </h1>
      <p class="mt-6 max-w-2xl text-lg text-brand-muted">
        LaunchLog is the log of what just shipped, with structured and machine-readable
        product pages built for search and AI discovery.
      </p>

      <div class="mt-10">
        <IntakePreviewForm />
      </div>

      <p class="mt-8 text-sm text-brand-muted">
        <template v-if="user">
          Signed in as <strong class="text-brand-fg">{{ user.email }}</strong> —
          <NuxtLink to="/dashboard" class="text-brand-accent underline">
            Dashboard
          </NuxtLink>
        </template>
        <template v-else>
          Already listed?
          <NuxtLink to="/login" class="text-brand-accent underline">
            Sign in
          </NuxtLink>
        </template>
      </p>
    </section>

    <section v-if="homeListingsFailed" class="border-t border-brand-border">
      <div class="mx-auto max-w-6xl px-6 py-14">
        <div class="rounded-2xl border border-red-400/20 bg-red-400/[0.05] py-16 text-center">
          <p class="text-lg font-medium text-brand-fg">
            Listings are temporarily unavailable
          </p>
          <p class="mx-auto mt-2 max-w-sm text-brand-muted">
            The directory could not be loaded. Please try again.
          </p>
          <Button class="mt-6" variant="outline" @click="() => refreshHomeListings()">
            Try again
          </Button>
        </div>
      </div>
    </section>

    <section v-if="featuredListings.length" class="border-t border-brand-border">
      <div class="mx-auto max-w-6xl px-6 py-14">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-accent">
              Featured
            </p>
            <h2 class="mt-2 text-3xl font-bold text-brand-fg">
              Featured launches
            </h2>
          </div>
          <NuxtLink to="/featured" class="text-sm font-medium text-brand-accent transition-colors hover:text-brand-fg">
            View all featured
          </NuxtLink>
        </div>
        <ListingGrid class="mt-7" :listings="featuredListings" mode="homepage-featured" />
      </div>
    </section>

    <section v-if="recentListings.length" class="border-t border-brand-border">
      <div class="mx-auto max-w-6xl px-6 py-14">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
              Recently added
            </p>
            <h2 class="mt-2 text-3xl font-bold text-brand-fg">
              What just shipped
            </h2>
          </div>
          <NuxtLink to="/browse-all" class="text-sm font-medium text-brand-accent transition-colors hover:text-brand-fg">
            Browse all launches
          </NuxtLink>
        </div>
        <ListingGrid class="mt-7" :listings="recentListings" mode="uniform" />
      </div>
    </section>
  </main>
</template>
