<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/help`
const description
  = 'Answers to common questions about LaunchLog — getting listed, free previews, pricing, machine-readable discovery, moderation and your account.'

interface Faq { q: string, a: string }
interface Category { id: string, title: string, summary: string, faqs: Faq[] }

const categories: Category[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    summary: 'What LaunchLog is and how to get on it.',
    faqs: [
      { q: 'What is LaunchLog?', a: 'LaunchLog is a curated paid directory for indie makers, SaaS founders and tech launches. Every listing is a clean, structured product page built to be understood by people, search engines and AI answer engines like ChatGPT, Perplexity, Claude and Gemini.' },
      { q: 'How do I get listed?', a: 'Paste your product URL to generate a free private preview, edit the details, then choose a plan and publish. Your page goes live once payment succeeds and the listing passes review.' },
      { q: 'Is there a free listing?', a: 'There is no free public listing, but there is a free private preview so you can see exactly how your listing will look before you pay anything. You only pay when you decide to publish.' },
    ],
  },
  {
    id: 'listings',
    title: 'Listings & previews',
    summary: 'How previews, publishing and editing work.',
    faqs: [
      { q: 'What is a free preview?', a: 'When you submit a URL, we light-crawl it and build a private preview of your listing — screenshot, title, tagline, description and category. The preview is private, excluded from search and the directory, reachable only via its unguessable link, and it expires after 7 days.' },
      { q: 'How long until my listing is live?', a: 'After a successful payment your listing is created and runs through enrichment and quality checks. Clean listings publish right away; a small number that get flagged go to a short manual review first.' },
      { q: 'Can I edit my listing?', a: 'Yes. You can edit the title, tagline, short description and category from the preview before publishing, and from your dashboard afterwards.' },
      { q: 'What does a listing include?', a: 'A dedicated public page on launchlog.ai with your product link, a human-readable summary, category context, a screenshot, schema.org structured data, sitemap inclusion and AI-friendly metadata.' },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing & billing',
    summary: 'Plans, renewals and refunds.',
    faqs: [
      { q: 'How much does it cost?', a: 'Basic is $24.99/year, Premium is $59.99/year, and Featured is $99/year as a launch price (regularly $149/year). All plans are annual and in USD.' },
      { q: 'Is billing monthly or annual?', a: 'Annual only. Plans renew automatically each year unless you cancel before the renewal date.' },
      { q: 'Do you offer refunds?', a: 'Yes — a 7-day money-back guarantee. If LaunchLog is not for you, email support@launchlog.ai within 7 days of your first payment and we will refund it and remove the listing.' },
      { q: 'How do I cancel?', a: 'You can cancel anytime from your billing settings to stop future renewals. Your listing stays live until the end of the period you have paid for.' },
    ],
  },
  {
    id: 'tech-edge',
    title: 'The tech edge',
    summary: 'Why LaunchLog pages are built for AI and search.',
    faqs: [
      { q: 'How does LaunchLog help AI discovery?', a: 'Every listing ships schema.org JSON-LD in an @graph, is included in a dynamic llms.txt, and supports content-negotiated markdown — so search crawlers and large language models can read and cite your product cleanly. Users see a normal directory page; machines see structured, citable data.' },
      { q: 'What is llms.txt?', a: 'llms.txt is an emerging convention that gives AI systems a clean, machine-readable map of a site’s content. LaunchLog generates one automatically so your listing is easy for LLMs to find and quote.' },
      { q: 'Will I rank #1 on Google?', a: 'No directory can promise a ranking, and we never will. What we do is give your product a well-structured, indexable, citable page — a credible signal that helps discovery across search and AI surfaces. The outcome still depends on your product and market.' },
    ],
  },
  {
    id: 'account',
    title: 'Account & moderation',
    summary: 'Reviews, rejections and your data.',
    faqs: [
      { q: 'How are submissions reviewed?', a: 'We use a hybrid of automated spam and quality checks plus human review. Most listings publish instantly; flagged or uncertain ones get a quick manual look before going live.' },
      { q: 'Why was my listing flagged or rejected?', a: 'Common reasons are misleading claims, spammy SEO tactics, prohibited content, or not being authorised to list the product. If you think it was a mistake, reply to the review email or contact support and we will take another look.' },
      { q: 'How do I delete my account or data?', a: 'Email privacy@launchlog.ai and we will handle deletion and data requests in line with our Privacy Policy and applicable law.' },
    ],
  },
]

useSeoMeta({
  title: 'Help Center — LaunchLog',
  description,
  ogTitle: 'Help Center — LaunchLog',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'website',
  twitterTitle: 'Help Center — LaunchLog',
  twitterDescription: description,
})

useHead({
  link: [{ rel: 'canonical', href: pageUrl }],
  script: [
    {
      key: 'launchlog-help-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        url: pageUrl,
        inLanguage: 'en-US',
        isPartOf: { '@id': `${siteUrl}/#website` },
        mainEntity: categories.flatMap(c => c.faqs).map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }),
    },
  ],
})
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-14 md:py-20">
    <header class="max-w-2xl">
      <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
        Help Center
      </p>
      <h1 class="mt-5 text-4xl font-bold tracking-normal text-white md:text-6xl">
        How can we help?
      </h1>
      <p class="mt-6 text-lg leading-8 text-brand-muted">
        Straight answers about getting listed, pricing, the tech edge and your
        account. Can’t find it here? The team is one email away.
      </p>
    </header>

    <div class="mt-14 space-y-12">
      <section
        v-for="category in categories"
        :key="category.id"
        :id="category.id"
        class="scroll-mt-24 grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]"
      >
        <div class="lg:sticky lg:top-24 lg:self-start">
          <h2 class="text-2xl font-semibold text-white">
            {{ category.title }}
          </h2>
          <p class="mt-3 leading-7 text-brand-muted">
            {{ category.summary }}
          </p>
        </div>

        <div class="divide-y divide-brand-border overflow-hidden rounded-lg border border-brand-border bg-white/[0.02]">
          <details
            v-for="faq in category.faqs"
            :key="faq.q"
            class="group"
          >
            <summary class="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-medium text-white transition-colors hover:bg-white/[0.03]">
              {{ faq.q }}
              <svg class="size-5 shrink-0 text-brand-muted transition-transform duration-200 group-open:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14" />
              </svg>
            </summary>
            <div class="px-5 pb-5 leading-7 text-brand-muted">
              {{ faq.a }}
            </div>
          </details>
        </div>
      </section>
    </div>

    <section class="mt-16 rounded-lg border border-brand-border bg-white/[0.03] p-6 md:p-8">
      <div class="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 class="text-2xl font-semibold text-white">
            Still stuck?
          </h2>
          <p class="mt-3 max-w-xl leading-7 text-brand-muted">
            Email the team and a real person will get back to you, usually within
            one business day.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <NuxtLink
            to="/contact"
            class="inline-flex rounded-md border border-brand-border px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/[0.04]"
          >
            Contact us
          </NuxtLink>
          <a
            href="mailto:support@launchlog.ai"
            class="inline-flex rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-accent/90"
          >
            Email support
          </a>
        </div>
      </div>
    </section>
  </main>
</template>
