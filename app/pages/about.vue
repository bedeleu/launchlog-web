<script setup lang="ts">
import { SITE_IDENTITY } from '#shared/constants/site-identity'

const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const aboutUrl = `${siteUrl}/about`
const aboutDescription = 'Learn who runs LaunchLog, how paid listings are published and moderated, and how the SaaS launch directory supports web discovery.'
const { plans } = usePlans()

const principles = [
  {
    title: 'Curated product profiles',
    body: 'Paid submissions publish after successful checkout and remain subject to LaunchLog moderation. The goal is to keep every public page useful to founders, buyers and compatible discovery systems.',
  },
  {
    title: 'Structured by default',
    body: 'Listing pages combine visible product facts with schema.org, canonical metadata, markdown output and concise summaries so the same information is easier to parse and reference.',
  },
  {
    title: 'Practical visibility',
    body: 'The editorial focus is simple: help indie makers and SaaS founders describe what they shipped in a way that can be discovered across Google, Bing and AI search surfaces.',
  },
]

const editorialStandards = [
  'We avoid guaranteed ranking claims, fake metrics and spammy backlink language.',
  'We prefer clear product descriptions, specific use cases and verifiable company information.',
  'We write for both humans and machines: concise summaries, structured metadata and useful context.',
  'We disclose paid placement separately from moderation and do not promise a fixed position.',
]

const steps = [
  {
    number: '01',
    title: 'Submit your launch',
    body: 'Add your product URL, category, short positioning and the audience you serve.',
  },
  {
    number: '02',
    title: 'We shape the listing',
    body: 'LaunchLog prepares an editable profile with a description, metadata, category context and machine-readable output.',
  },
  {
    number: '03',
    title: 'Your page goes live',
    body: 'After successful checkout, the listing gets a public URL, appears in the directory and is included in the sitemap and optional machine-readable feeds.',
  },
]

const listingIncludes = [
  'Dedicated listing page on launchlog.ai',
  'Direct product website link',
  'Human-readable product summary',
  'Category, launch and discovery context',
  'Schema.org JSON-LD for structured understanding',
  'Sitemap inclusion and machine-readable metadata',
]

useSeoMeta({
  title: 'About LaunchLog — Curated SaaS launch directory',
  description: aboutDescription,
  ogTitle: 'About LaunchLog',
  ogDescription: aboutDescription,
  ogUrl: aboutUrl,
  ogType: 'website',
  ogImage: `${siteUrl}/og-image.jpg`,
  ogImageSecureUrl: `${siteUrl}/og-image.jpg`,
  twitterCard: 'summary_large_image',
  twitterTitle: 'About LaunchLog',
  twitterDescription: aboutDescription,
  twitterImage: `${siteUrl}/og-image.jpg`,
})

useBreadcrumbs([
  { name: 'Home', path: '/' },
  { name: 'About', path: '/about' },
])

useHead({
  link: [
    {
      rel: 'canonical',
      href: aboutUrl,
    },
  ],
  script: [
    {
      key: 'launchlog-about-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'AboutPage',
            '@id': `${aboutUrl}#webpage`,
            url: aboutUrl,
            name: 'About LaunchLog',
            description: aboutDescription,
            inLanguage: 'en-US',
            isPartOf: {
              '@id': `${siteUrl}/#website`,
            },
            about: {
              '@id': `${siteUrl}/#organization`,
            },
          },
          {
            '@type': 'Person',
            '@id': `${aboutUrl}#alexandru-bedeleu`,
            name: SITE_IDENTITY.founder.name,
            url: aboutUrl,
            sameAs: [SITE_IDENTITY.founder.profileUrl],
            jobTitle: 'Founder and full-stack developer',
            worksFor: {
              '@type': 'Organization',
              name: SITE_IDENTITY.operatorName,
            },
            knowsAbout: [
              'full-stack development',
              'SaaS products',
              'technical SEO',
              'structured data',
              'AI search visibility',
              'product launch distribution',
            ],
          },
          {
            '@type': 'Organization',
            '@id': `${siteUrl}/#organization`,
            name: SITE_IDENTITY.brandName,
            url: `${siteUrl}/`,
            slogan: SITE_IDENTITY.slogan,
            email: SITE_IDENTITY.publicEmail,
            logo: `${siteUrl}${SITE_IDENTITY.logoPath}`,
            sameAs: SITE_IDENTITY.socialProfiles,
            founder: {
              '@id': `${aboutUrl}#alexandru-bedeleu`,
            },
            description: SITE_IDENTITY.description,
            makesOffer: plans.map(plan => ({
              '@type': 'Offer',
              name: `${plan.name} LaunchLog listing`,
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
  <ContentReadingShell
    wide
    label="Institutional record · LaunchLog"
    title="The log of what just shipped."
    intro="LaunchLog gives new products a durable public record that people, search engines and compatible machine readers can understand."
  >
    <template #meta>
      <ContentReadingMeta
        :items="[
        { label: 'Founder', value: SITE_IDENTITY.founder.name },
        { label: 'Operator', value: SITE_IDENTITY.operatorName },
        { label: 'Format', value: 'Curated directory' },
        ]"
      />
    </template>

    <section class="grid border-y border-release-seam lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="reading-prose py-9 lg:border-r lg:border-release-seam lg:pr-12">
        <h2>Visibility through curation, not spam.</h2>
        <p class="mt-5">
          A useful launch record explains what shipped, who it helps and why it matters.
          LaunchLog combines that visible story with canonical metadata, structured data
          and consistent machine-readable output.
        </p>
        <p class="mt-5">
          The result is a real public source that remains useful after launch day instead
          of another promotional row in a feed.
        </p>
      </div>
      <aside class="py-9 lg:pl-10">
        <p class="release-kicker">Maintained by</p>
        <h2 class="mt-4 text-2xl font-semibold tracking-tight text-[#f6f1e7]">Alexandru Bedeleu</h2>
        <p class="mt-4 leading-7 text-release-paper-muted">
          Full-stack developer and founder of {{ SITE_IDENTITY.operatorName }}, with 19+ years building
          production web products, automation systems and discovery software.
        </p>
        <a :href="SITE_IDENTITY.founder.profileUrl" target="_blank" rel="me noopener" class="mt-5 inline-flex font-mono text-xs uppercase tracking-[0.12em] text-release-blaze underline-offset-4 hover:underline">
          LinkedIn profile ↗
        </a>
      </aside>
    </section>

    <section class="mt-14" aria-label="LaunchLog principles">
      <p class="release-kicker">Editorial position</p>
      <div class="mt-5 grid border-t border-l border-release-seam md:grid-cols-3">
        <article v-for="(principle, index) in principles" :key="principle.title" class="border-r border-b border-release-seam p-6 md:p-7">
          <p class="font-mono text-[11px] text-release-paper-muted">0{{ index + 1 }}</p>
          <h2 class="mt-5 text-xl font-semibold tracking-tight text-[#f6f1e7]">{{ principle.title }}</h2>
          <p class="mt-4 leading-7 text-release-paper-muted">{{ principle.body }}</p>
        </article>
      </div>
    </section>

    <section class="mt-14 grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div>
        <p class="release-kicker">Publication path</p>
        <h2 class="mt-4 text-3xl font-semibold tracking-tight text-[#f6f1e7]">From URL to public record.</h2>
      </div>
      <ol class="border-t border-release-seam">
        <li v-for="step in steps" :key="step.number" class="grid gap-3 border-b border-release-seam py-6 sm:grid-cols-[3rem_13rem_minmax(0,1fr)]">
          <span class="font-mono text-xs text-release-blaze">{{ step.number }}</span>
          <strong class="text-[#f6f1e7]">{{ step.title }}</strong>
          <span class="leading-7 text-release-paper-muted">{{ step.body }}</span>
        </li>
      </ol>
    </section>

    <section class="mt-14 grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div>
        <p class="release-kicker">Publication contents</p>
        <h2 class="mt-4 text-3xl font-semibold tracking-tight text-[#f6f1e7]">A page, not a row.</h2>
      </div>
      <ul class="grid border-t border-l border-release-seam sm:grid-cols-2">
        <li v-for="item in listingIncludes" :key="item" class="border-r border-b border-release-seam p-5 text-sm font-medium leading-6 text-[#f6f1e7]">{{ item }}</li>
      </ul>
    </section>

    <section class="mt-14 grid gap-8 border-y border-release-seam py-10 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div>
        <p class="release-kicker">Editorial standards</p>
        <h2 class="mt-4 text-3xl font-semibold tracking-tight text-[#f6f1e7]">Clear, useful and defensible.</h2>
      </div>
      <ul class="space-y-4">
        <li v-for="standard in editorialStandards" :key="standard" class="flex gap-4 leading-7 text-release-paper-muted">
          <span class="mt-2.5 size-2 shrink-0 bg-release-blaze" aria-hidden="true" />
          <span>{{ standard }}</span>
        </li>
      </ul>
    </section>

    <section class="mt-14 grid border-t border-l border-release-seam md:grid-cols-2">
      <article class="border-r border-b border-release-seam p-7">
        <p class="release-kicker">For founders</p>
        <h2 class="mt-4 text-2xl font-semibold tracking-tight text-[#f6f1e7]">Prepare a private release.</h2>
        <p class="mt-4 max-w-xl leading-7 text-release-paper-muted">Paste a real product homepage. LaunchLog captures the evidence and lets you review everything before publication.</p>
        <NuxtLink to="/submit" class="release-action mt-6">Preview a launch</NuxtLink>
      </article>
      <article class="border-r border-b border-release-seam p-7">
        <p class="release-kicker">For readers</p>
        <h2 class="mt-4 text-2xl font-semibold tracking-tight text-[#f6f1e7]">Browse the permanent catalog.</h2>
        <p class="mt-4 max-w-xl leading-7 text-release-paper-muted">Find recently shipped products through authored records with visible facts and verifiable destinations.</p>
        <NuxtLink to="/browse-all" class="release-action-secondary mt-6">Browse releases</NuxtLink>
      </article>
    </section>
  </ContentReadingShell>
</template>
