<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { SITE_IDENTITY } from '#shared/constants/site-identity'
import type { ListingCard } from '~/composables/useListings'
import { composeHomepageListings } from '~/utils/listing-placement'

const { user } = useAuth()
const { listListings } = useListings()
const editionClient = useEditions()

// Editions are an editorial discovery surface, not homepage listing inventory.
// Start the request independently and fail it soft so neither upstream can hide
// or postpone the other surface.
const latestEditionRequest = useAsyncData('homepage-latest-edition', async () => {
  try {
    return (await editionClient.fetchArchive(1)).data[0] ?? null
  }
  catch {
    return null
  }
})

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
      // One extra slot keeps all three paid placements visible when the latest
      // release is also in the Featured cohort.
      listListings({ tier: 'featured', sort: 'priority', per_page: HOMEPAGE_FEATURED_SLOTS + 1 }),
      // The latest release becomes the hero and every visible Featured slug is
      // removed from the recent grid, so fetch enough real records to refill it.
      listListings({
        sort: 'recent',
        per_page: HOMEPAGE_RECENT_SLOTS + HOMEPAGE_FEATURED_SLOTS + 1,
      }),
    ])

    return { featured, recent }
  },
  { default: () => ({ featured: [], recent: [] }) },
)
const { data: latestEdition } = await latestEditionRequest

const homepageComposition = computed(() => composeHomepageListings(
  homeListings.value?.featured ?? [],
  homeListings.value?.recent ?? [],
  HOMEPAGE_FEATURED_SLOTS,
  HOMEPAGE_RECENT_SLOTS,
))

const heroListing = computed(() => homepageComposition.value.hero)
const featuredListings = computed(() => homepageComposition.value.featured)
const recentListings = computed(() => homepageComposition.value.recent)
const heroHost = computed(() => {
  if (!heroListing.value) return 'Private preview · no payment required'
  try {
    return new URL(heroListing.value.url).hostname.replace(/^www\./, '')
  }
  catch {
    return heroListing.value.url
  }
})

// A failed fetch used to fall through to the empty default, which removed the
// paid Homepage Featured section with no signal at all.
if (import.meta.server && homeListingsError.value) {
  console.error('[home] directory listings failed to load', homeListingsError.value)
}

const homeListingsFailed = computed(() =>
  Boolean(homeListingsError.value) && !featuredListings.value.length && !recentListings.value.length)

const config = useRuntimeConfig()
const { plans } = usePlans()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const homeUrl = `${siteUrl}/`
const ogImageUrl = `${siteUrl}/og-image.jpg`
const organizationLogoUrl = `${siteUrl}${SITE_IDENTITY.logoPath}`
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
            name: SITE_IDENTITY.brandName,
            url: homeUrl,
            description: SITE_IDENTITY.description,
            slogan: SITE_IDENTITY.slogan,
            email: SITE_IDENTITY.publicEmail,
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
              url: organizationLogoUrl,
              width: 1024,
              height: 1024,
            },
            image: ogImageUrl,
            sameAs: SITE_IDENTITY.socialProfiles,
            contactPoint: {
              '@type': 'ContactPoint',
              email: SITE_IDENTITY.publicEmail,
              contactType: 'customer support',
              availableLanguage: ['English', 'Romanian'],
            },
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
              'A curated paid directory for indie makers, SaaS founders and tech launches, with visible product facts and machine-readable output on every listing.',
            provider: { '@id': `${siteUrl}/#organization` },
            image: ogImageUrl,
            offers: plans.map(plan => ({
              '@type': 'Offer',
              name: plan.name,
              price: (plan.annualPriceCents / 100).toFixed(2),
              priceCurrency: plan.currency,
            })),
          },
        ],
      }),
    },
  ],
})
</script>

<template>
  <div class="min-h-screen">
    <ReleaseShell
      wide-rail
      eyebrow="Release catalog · 2027"
      title="The log of what just shipped."
      description="A permanent public record for products worth finding — built for people, search engines, and machine-readable discovery."
    >
      <div class="border border-release-seam bg-release-rail p-3 sm:p-4">
        <ReleaseCover
          :src="heroListing?.screenshot_url"
          :alt="heroListing ? `${heroListing.name} website screenshot` : 'LaunchLog release cover'"
          :title="heroListing?.name ?? 'Your product becomes the next release'"
          image-class="object-contain object-top"
        >
          <template #caption>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
                <p class="flex flex-wrap items-center gap-x-2 font-mono text-[0.62rem] font-semibold tracking-[0.14em] text-release-ink/65 uppercase">
                  <span aria-hidden="true" class="size-2 bg-release-blaze" />
                  <span>Latest release</span>
                  <span aria-hidden="true" class="text-release-ink/35">·</span>
                  <span>Published record</span>
                </p>
                <p class="min-w-0 max-w-full truncate font-mono text-[0.68rem] tracking-[0.08em] text-release-ink/65 sm:max-w-56 sm:text-right">
                  {{ heroHost }}
                </p>
              </div>
              <p class="mt-2 line-clamp-2 text-sm font-semibold tracking-[-0.02em] sm:text-base">
                {{ heroListing?.name ?? 'Your product becomes the next release' }}
              </p>
            </div>
          </template>
        </ReleaseCover>
      </div>

      <template #rail>
        <ReleaseActionRail
          step="Private preview"
          title="Prepare your release"
          description="Paste one public URL. We capture the site and prepare the listing before you choose a placement."
        >
          <IntakePreviewForm stacked source="homepage" />
          <ReleaseStateMarker
            state="active"
            label="Human approval"
            detail="Nothing publishes until you review it."
          />
          <template #footer>
            <p class="text-sm leading-6 text-release-paper-muted">
              <template v-if="user">
                Signed in as <strong class="text-release-paper">{{ user.email }}</strong> ·
                <NuxtLink to="/dashboard" class="text-release-blaze underline underline-offset-4">Dashboard</NuxtLink>
              </template>
              <template v-else>
                Already listed?
                <NuxtLink to="/login" class="text-release-blaze underline underline-offset-4">Sign in</NuxtLink>
              </template>
            </p>
          </template>
        </ReleaseActionRail>
      </template>
    </ReleaseShell>

    <section v-if="homeListingsFailed" class="border-t border-release-seam">
      <div class="mx-auto max-w-[96rem] px-4 py-14 sm:px-8 lg:px-12">
        <div class="border border-release-destructive/50 bg-release-rail py-14 text-center">
          <p class="text-lg font-medium text-[#f6f1e7]">
            Listings are temporarily unavailable
          </p>
          <p class="mx-auto mt-2 max-w-sm text-release-paper-muted">
            The directory could not be loaded. Please try again.
          </p>
          <Button class="mt-6" variant="outline" @click="() => refreshHomeListings()">
            Try again
          </Button>
        </div>
      </div>
    </section>

    <section v-if="featuredListings.length" class="border-t border-release-seam">
      <div class="mx-auto max-w-[96rem] px-4 py-14 sm:px-8 lg:px-12">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <h2 class="text-3xl font-semibold tracking-[-0.03em] text-[#f6f1e7]">
            Featured launches
          </h2>
          <NuxtLink to="/featured" class="font-mono text-xs font-semibold tracking-[0.08em] text-release-blaze uppercase transition-colors hover:text-release-paper">
            View all featured
          </NuxtLink>
        </div>
        <ListingGrid class="mt-7" :listings="featuredListings" mode="homepage-featured" />
      </div>
    </section>

    <section v-if="latestEdition" class="border-t border-release-seam" aria-labelledby="latest-edition-title">
      <div class="mx-auto max-w-[96rem] px-4 py-12 sm:px-8 lg:px-12">
        <div class="flex flex-wrap items-end justify-between gap-4 border-b border-release-seam pb-5">
          <div>
            <p class="font-mono text-[0.68rem] font-semibold tracking-[0.2em] text-release-warning uppercase">
              Weekly record
            </p>
            <h2 id="latest-edition-title" class="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#f6f1e7]">
              Latest weekly edition
            </h2>
          </div>
          <NuxtLink to="/shipped" class="font-mono text-xs font-semibold tracking-[0.08em] text-release-blaze uppercase transition-colors hover:text-release-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus focus-visible:ring-offset-4 focus-visible:ring-offset-release-ink">
            Browse the archive
          </NuxtLink>
        </div>
        <div class="border-t border-release-seam">
          <EditionSummary :summary="latestEdition" />
        </div>
      </div>
    </section>

    <section v-if="recentListings.length" class="border-t border-release-seam">
      <div class="mx-auto max-w-[96rem] px-4 py-14 sm:px-8 lg:px-12">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="font-mono text-[0.68rem] font-semibold tracking-[0.2em] text-release-warning uppercase">
              Recently added
            </p>
            <h2 class="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#f6f1e7]">
              What just shipped
            </h2>
          </div>
          <NuxtLink to="/browse-all" class="font-mono text-xs font-semibold tracking-[0.08em] text-release-blaze uppercase transition-colors hover:text-release-paper">
            Browse all launches
          </NuxtLink>
        </div>
        <ListingGrid class="mt-7" :listings="recentListings" mode="uniform" />
      </div>
    </section>
  </div>
</template>
