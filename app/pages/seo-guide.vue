<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/seo-guide`
const updated = 'August 26, 2026'
const description
  = 'A practical 2026 guide to making SaaS launch pages crawlable, indexable, useful and machine-readable without relying on unsupported AEO or GEO hacks.'

const pillars = [
  {
    n: '01',
    title: 'Visible facts + matching schema',
    body: 'Every listing presents the product facts in visible HTML and emits matching schema.org JSON-LD. Structured data describes the page; it does not guarantee ranking, indexing or an AI citation.',
  },
  {
    n: '02',
    title: 'Crawl and discovery signals',
    body: 'Published listings have canonical URLs, sitemap entries and IndexNow notifications. LaunchLog also maintains llms.txt for compatible non-Google consumers; Google states that it ignores this file.',
  },
  {
    n: '03',
    title: 'Consistent alternate output',
    body: 'A request with Accept: text/markdown returns the same listing facts in markdown from the canonical URL. It is an optional machine-readable representation, not a replacement for useful public HTML.',
  },
]

const technicalChecklist = [
  'Responsive pages with Core Web Vitals measured in field data',
  'HTTPS everywhere with a valid certificate',
  'Clean, canonical URLs (no duplicate-content traps)',
  'An XML sitemap that search engines can crawl',
  'Structured data (schema.org) on key pages',
  'Crawl and indexing issues monitored in Search Console and Bing Webmaster Tools',
]

const contentChecklist = [
  'A clear value proposition in the first sentence',
  'Specific use cases and the audience you serve',
  'Natural keywords — written for humans, not stuffed',
  'A descriptive title and meta description',
  'Descriptive alt text on screenshots and images',
  'Fresh, accurate information that you keep updated',
]

const discovery = [
  { title: 'Relevant directories', body: 'A dedicated listing can add durable product context and a discoverable link outside launch-day feeds. Relevance and factual quality matter more than submitting to every directory.' },
  { title: 'Content & community', body: 'Write, ship in public, and show up where your audience already is. Earned mentions compound over time.' },
  { title: 'Technical hygiene', body: 'Speed, structure and crawlability are the boring fundamentals that make everything else you do actually count.' },
]

const comparison = {
  generic: {
    label: 'A row in a generic directory',
    points: [
      'A link and a name in a long table',
      'Product facts spread across several destinations',
      'Little context after the launch-day feed moves on',
      'No alternate machine-readable representation',
    ],
  },
  launchlog: {
    label: 'A LaunchLog listing',
    points: [
      'A dedicated product page while the plan is active',
      'Visible facts + schema.org + markdown output',
      'Permanent placement while your plan is active',
      'Sitemap inclusion and IndexNow notification',
    ],
  },
}

const officialSources = [
  {
    label: 'Google: Optimizing for generative AI features',
    href: 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide',
  },
  {
    label: 'Google: Pagination and incremental page loading',
    href: 'https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading',
  },
  {
    label: 'Google: Creating helpful, reliable, people-first content',
    href: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content',
  },
  {
    label: 'OpenAI: Overview of OpenAI crawlers',
    href: 'https://developers.openai.com/api/docs/bots',
  },
  {
    label: 'IndexNow: Protocol documentation',
    href: 'https://www.indexnow.org/documentation',
  },
  {
    label: 'web.dev: Build agent-friendly websites',
    href: 'https://web.dev/articles/ai-agent-site-ux',
  },
]

useSeoMeta({
  title: 'The 2026 SEO & AI Discovery Guide — LaunchLog',
  description,
  ogTitle: 'The 2026 SEO & AI Discovery Guide',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'article',
  ogImage: `${siteUrl}/og-image.jpg`,
  ogImageSecureUrl: `${siteUrl}/og-image.jpg`,
  twitterCard: 'summary_large_image',
  twitterTitle: 'The 2026 SEO & AI Discovery Guide',
  twitterDescription: description,
  twitterImage: `${siteUrl}/og-image.jpg`,
})

useBreadcrumbs([
  { name: 'Home', path: '/' },
  { name: 'SEO Guide', path: '/seo-guide' },
])

useHead({
  link: [{ rel: 'canonical', href: pageUrl }],
  script: [
    {
      key: 'launchlog-seoguide-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        '@id': `${pageUrl}#article`,
        headline: 'The 2026 SEO & AI Discovery Guide for SaaS Launches',
        description,
        url: pageUrl,
        inLanguage: 'en-US',
        datePublished: '2026-05-31',
        dateModified: '2026-08-26',
        author: {
          '@type': 'Person',
          name: 'Alexandru Bedeleu',
          url: `${siteUrl}/about`,
        },
        mainEntityOfPage: pageUrl,
        isPartOf: { '@id': `${siteUrl}/#website` },
        publisher: { '@id': `${siteUrl}/#organization` },
      }),
    },
  ],
})
</script>

<template>
  <ContentReadingShell
    wide
    :label="`Field guide · Updated ${updated}`"
    title="Make your launch useful, crawlable and machine-readable."
    intro="AI search starts with the same web fundamentals as search: useful public content, crawl access, correct indexing signals and a stable source of product facts."
  >
    <template #meta>
      <ContentReadingMeta
        :items="[
        { label: 'Edition', value: '2026' },
        { label: 'Audience', value: 'Product teams' },
        { label: 'Method', value: 'Primary sources' },
        ]"
      />
    </template>

    <section class="grid gap-8 border-b border-release-seam pb-12 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div>
        <p class="release-kicker">The shift</p>
        <h2 class="mt-4 text-3xl font-semibold tracking-tight text-[#f6f1e7]">One source, several kinds of readers.</h2>
      </div>
      <div class="reading-prose">
        <p>A launch page may be read by a founder, a buyer, a search crawler or a user-triggered browser agent. Each system has its own selection rules, but all benefit from stable URLs and clear public facts.</p>
        <p class="mt-5">Keep visible copy, canonical metadata, structured data and alternate representations consistent. That reduces ambiguity without pretending markup can force indexing or citation.</p>
      </div>
    </section>

    <section class="mt-14">
      <p class="release-kicker">LaunchLog publication contract</p>
      <div class="mt-5 grid border-t border-l border-release-seam md:grid-cols-3">
        <article v-for="pillar in pillars" :key="pillar.n" class="border-r border-b border-release-seam p-6">
          <p class="font-mono text-xs text-release-blaze">{{ pillar.n }}</p>
          <h2 class="mt-5 text-xl font-semibold tracking-tight text-[#f6f1e7]">{{ pillar.title }}</h2>
          <p class="mt-4 leading-7 text-release-paper-muted">{{ pillar.body }}</p>
        </article>
      </div>
    </section>

    <section class="mt-14 grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div>
        <p class="release-kicker">Fundamentals</p>
        <h2 class="mt-4 text-3xl font-semibold tracking-tight text-[#f6f1e7]">The checklist that still wins.</h2>
        <p class="mt-4 leading-7 text-release-paper-muted">Get these right before chasing anything clever.</p>
      </div>
      <div class="grid border-t border-l border-release-seam md:grid-cols-2">
        <div v-for="group in [{ title: 'Technical SEO', items: technicalChecklist }, { title: 'Content optimisation', items: contentChecklist }]" :key="group.title" class="border-r border-b border-release-seam p-6">
          <h3 class="text-lg font-semibold text-[#f6f1e7]">{{ group.title }}</h3>
          <ul class="mt-5 space-y-3">
            <li v-for="item in group.items" :key="item" class="flex gap-3 leading-7 text-release-paper-muted"><span class="mt-2.5 size-2 shrink-0 bg-release-signal" aria-hidden="true" /><span>{{ item }}</span></li>
          </ul>
        </div>
      </div>
    </section>

    <section class="mt-14">
      <p class="release-kicker">Where listings fit</p>
      <h2 class="mt-4 text-3xl font-semibold tracking-tight text-[#f6f1e7]">Discovery is a portfolio, not a hack.</h2>
      <div class="mt-6 grid border-t border-l border-release-seam md:grid-cols-3">
        <article v-for="method in discovery" :key="method.title" class="border-r border-b border-release-seam p-6">
          <h3 class="text-lg font-semibold text-[#f6f1e7]">{{ method.title }}</h3>
          <p class="mt-3 leading-7 text-release-paper-muted">{{ method.body }}</p>
        </article>
      </div>
    </section>

    <section class="mt-14 grid border-t border-l border-release-seam md:grid-cols-2">
      <article v-for="record in [comparison.generic, comparison.launchlog]" :key="record.label" class="border-r border-b border-release-seam p-7" :class="record === comparison.launchlog ? 'border-t-2 border-t-release-blaze bg-release-rail' : ''">
        <p class="release-kicker">{{ record.label }}</p>
        <ul class="mt-5 space-y-3">
          <li v-for="point in record.points" :key="point" class="flex gap-3 leading-7 text-release-paper-muted"><span class="font-mono text-release-blaze" aria-hidden="true">—</span><span>{{ point }}</span></li>
        </ul>
      </article>
    </section>

    <section class="mt-14 grid gap-8 border-y border-release-seam py-10 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div>
        <p class="release-kicker">Primary references</p>
        <h2 class="mt-4 text-3xl font-semibold tracking-tight text-[#f6f1e7]">Check the source, not an AEO score.</h2>
      </div>
      <div>
        <p class="max-w-3xl leading-8 text-release-paper-muted">This guide is maintained against first-party documentation. Search and crawler behavior changes, so these sources take precedence over any summary here.</p>
        <ul class="mt-6 border-t border-release-seam">
          <li v-for="source in officialSources" :key="source.href" class="border-b border-release-seam py-3">
            <a :href="source.href" target="_blank" rel="noopener" class="font-medium text-[#f6f1e7] underline-offset-4 hover:text-release-blaze hover:underline">{{ source.label }} ↗</a>
          </li>
        </ul>
      </div>
    </section>

    <section class="mt-14 flex flex-col gap-6 border-l-2 border-release-blaze bg-release-rail p-7 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="release-kicker">Private preview</p>
        <h2 class="mt-3 text-2xl font-semibold tracking-tight text-[#f6f1e7]">See how your product would appear.</h2>
        <p class="mt-3 max-w-2xl leading-7 text-release-paper-muted">Paste your URL and review the structured release before you publish.</p>
      </div>
      <div class="flex flex-wrap gap-3"><NuxtLink to="/pricing" class="release-action-secondary">View pricing</NuxtLink><NuxtLink to="/submit" class="release-action">Preview for free</NuxtLink></div>
    </section>
  </ContentReadingShell>
</template>
