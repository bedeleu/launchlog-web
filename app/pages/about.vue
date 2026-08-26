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
              name: 'AB Solutions',
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
  <main class="mx-auto max-w-6xl px-6 py-14 md:py-20">
    <section class="grid gap-10 md:grid-cols-[1fr_0.65fr] md:items-end">
      <div>
        <p class="text-brand-muted text-sm font-semibold uppercase tracking-[0.18em]">
          About LaunchLog
        </p>
        <h1 class="mt-5 max-w-4xl text-4xl font-bold tracking-normal text-white md:text-6xl">
          The log of what just shipped.
        </h1>
        <p class="text-brand-muted mt-6 max-w-3xl text-lg leading-8">
          LaunchLog is a curated paid directory for indie makers, SaaS founders
          and tech launches. It exists to give new products a clean, structured
          public profile that can be understood by people, search engines and AI
          answer engines.
        </p>
      </div>

      <aside class="border-l border-brand-border pl-6">
        <p class="text-sm font-semibold text-white">
          Built by Alexandru Bedeleu
        </p>
        <p class="text-brand-muted mt-3 leading-7">
          Alexandru is a full-stack developer and founder of AB Solutions, with
          19+ years of experience building production web products, automation
          systems and SEO-focused software.
        </p>
        <a
          :href="SITE_IDENTITY.founder.profileUrl"
          target="_blank"
          rel="me noopener"
          class="mt-4 inline-flex text-sm font-medium text-brand-accent transition-colors hover:text-white hover:underline"
        >
          Alexandru on LinkedIn
        </a>
      </aside>
    </section>

    <section class="mt-16 grid gap-4 md:grid-cols-3" aria-label="LaunchLog principles">
      <article
        v-for="principle in principles"
        :key="principle.title"
        class="rounded-lg border border-brand-border bg-white/[0.03] p-6"
      >
        <h2 class="text-xl font-semibold text-white">
          {{ principle.title }}
        </h2>
        <p class="text-brand-muted mt-4 leading-7">
          {{ principle.body }}
        </p>
      </article>
    </section>

    <section class="mt-16 grid gap-10 md:grid-cols-[0.7fr_1fr]">
      <div>
        <p class="text-brand-muted text-sm font-semibold uppercase tracking-[0.18em]">
          What we do
        </p>
        <h2 class="mt-4 text-3xl font-bold tracking-normal text-white md:text-4xl">
          Visibility through curation, not spam.
        </h2>
      </div>
      <div class="space-y-6 text-brand-muted leading-8">
        <p>
          Many launch pages are either too thin for search or too promotional
          for buyers. LaunchLog is built around a different idea: a launch page
          should describe what shipped, who it helps, why it matters and how it
          fits into the broader SaaS ecosystem.
        </p>
        <p>
          That is why the platform focuses on human-readable descriptions,
          structured data, canonical URLs, markdown-friendly summaries and
          product context that gives search engines and compatible AI systems a
          consistent public source to parse.
        </p>
      </div>
    </section>

    <section class="mt-16">
      <div class="max-w-2xl">
        <p class="text-brand-muted text-sm font-semibold uppercase tracking-[0.18em]">
          How it works
        </p>
        <h2 class="mt-4 text-3xl font-bold tracking-normal text-white md:text-4xl">
          From submitted product to public launch profile.
        </h2>
      </div>

      <div class="mt-8 grid gap-4 md:grid-cols-3">
        <article
          v-for="step in steps"
          :key="step.number"
          class="rounded-lg border border-brand-border p-6"
        >
          <p class="font-mono text-sm text-brand-accent">
            {{ step.number }}
          </p>
          <h3 class="mt-5 text-xl font-semibold text-white">
            {{ step.title }}
          </h3>
          <p class="text-brand-muted mt-4 leading-7">
            {{ step.body }}
          </p>
        </article>
      </div>
    </section>

    <section class="mt-16 grid gap-10 md:grid-cols-[0.7fr_1fr]">
      <div>
        <p class="text-brand-muted text-sm font-semibold uppercase tracking-[0.18em]">
          What every listing includes
        </p>
        <h2 class="mt-4 text-3xl font-bold tracking-normal text-white md:text-4xl">
          A real page, not a row in a table.
        </h2>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div
          v-for="item in listingIncludes"
          :key="item"
          class="rounded-lg border border-brand-border bg-white/[0.03] p-4 text-sm font-medium text-white"
        >
          {{ item }}
        </div>
      </div>
    </section>

    <section class="mt-16 rounded-lg border border-brand-border bg-white/[0.03] p-6 md:p-8">
      <div class="grid gap-8 md:grid-cols-[0.55fr_1fr]">
        <div>
          <p class="text-brand-muted text-sm font-semibold uppercase tracking-[0.18em]">
            Editorial standards
          </p>
          <h2 class="mt-4 text-3xl font-bold tracking-normal text-white">
            Clear, useful and defensible.
          </h2>
        </div>
        <ul class="space-y-4">
          <li
            v-for="standard in editorialStandards"
            :key="standard"
            class="flex gap-3 text-brand-muted"
          >
            <span class="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-success" aria-hidden="true" />
            <span class="leading-7">{{ standard }}</span>
          </li>
        </ul>
      </div>
    </section>

    <section class="mt-16 grid gap-6 md:grid-cols-2">
      <div class="rounded-lg border border-brand-border p-6">
        <h2 class="text-2xl font-semibold text-white">
          For founders
        </h2>
        <p class="text-brand-muted mt-4 leading-7">
          Submit a launch when you want a structured profile for your SaaS,
          developer tool, AI product or indie project. LaunchLog is best suited
          for products with a real homepage, a clear audience and a specific
          problem they solve.
        </p>
        <NuxtLink
          to="/submit"
          class="mt-6 inline-flex rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-brand-accent/90"
        >
          Submit a launch
        </NuxtLink>
      </div>

      <div class="rounded-lg border border-brand-border p-6">
        <h2 class="text-2xl font-semibold text-white">
          For readers and crawlers
        </h2>
        <p class="text-brand-muted mt-4 leading-7">
          Browse LaunchLog to find recently shipped SaaS products and understand
          what each product does without digging through vague landing pages.
          Every published listing is shaped to be scannable, structured and easy
          to reference.
        </p>
        <NuxtLink
          to="/browse-all"
          class="mt-6 inline-flex rounded-md border border-brand-border px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.04]"
        >
          Browse launches
        </NuxtLink>
      </div>
    </section>

    <section class="mt-16 border-t border-brand-border pt-10">
      <div class="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 class="text-3xl font-bold tracking-normal text-white">
            Ready to list your SaaS launch?
          </h2>
          <p class="text-brand-muted mt-4 max-w-2xl leading-7">
            Choose a listing tier and get a dedicated, structured product page
            built for discovery across search and AI answer engines.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <NuxtLink
            to="/pricing"
            class="inline-flex rounded-md border border-brand-border px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.04]"
          >
            View pricing
          </NuxtLink>
          <NuxtLink
            to="/submit"
            class="inline-flex rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-brand-accent/90"
          >
            Get started
          </NuxtLink>
        </div>
      </div>
    </section>
  </main>
</template>
