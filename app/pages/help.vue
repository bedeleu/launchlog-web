<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/help`
const description
  = 'Answers to common questions about LaunchLog listings, private previews, pricing, billing, discovery and account access.'
const supportEmail = config.public.supportEmail.trim()
const taxNotice = config.public.taxNoticeEn.trim()
const legalEmail = config.public.legalEmail.trim()
const { plans } = usePlans()
const planPriceSummary = plans
  .map(plan => `${plan.name} is ${plan.priceLabel}/year`)
  .join(' and ')

interface Faq { q: string, a: string }
interface Category { id: string, title: string, summary: string, faqs: Faq[] }

const categories: Category[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    summary: 'What LaunchLog is and how to get on it.',
    faqs: [
      { q: 'What is LaunchLog?', a: 'LaunchLog is a curated paid directory for indie makers, SaaS founders and tech launches. Every published listing is a visible product page with structured metadata and machine-readable output.' },
      { q: 'How do I get listed?', a: 'Paste your product URL to generate a free private preview, edit the details, then choose a plan. A successful Stripe payment converts that preview into a published listing.' },
      { q: 'Is there a free listing?', a: 'There is no free public listing, but there is a free private preview so you can see exactly how your listing will look before you pay anything. You only pay when you decide to publish.' },
    ],
  },
  {
    id: 'listings',
    title: 'Listings & previews',
    summary: 'How previews, publishing and editing work.',
    faqs: [
      { q: 'What is a free preview?', a: 'When you submit a URL, we light-crawl it and build a private preview of your listing — screenshot, title, tagline, description and category. The preview is private, excluded from search and the directory, reachable only via its unguessable link, and it expires after 7 days.' },
      { q: 'How long until my listing is live?', a: 'A successful Stripe checkout creates and publishes the listing through the payment webhook. Provider or delivery delays can affect how quickly the completed checkout appears in your dashboard.' },
      { q: 'Can I edit my listing?', a: 'Yes. Before checkout you can edit the preview fields. After publishing, the customer dashboard currently lets you edit the listing name, tagline and description.' },
      { q: 'What does a listing include?', a: 'A dedicated public page on launchlog.ai with your product link, summary, category context, schema.org structured data, sitemap and llms.txt inclusion, markdown content negotiation, and a captured screenshot when one is available.' },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing & billing',
    summary: 'Plans, renewals and refunds.',
    faqs: [
      { q: 'How much does it cost?', a: `${planPriceSummary}. Both plans are annual and in USD.` },
      { q: 'Is billing monthly or annual?', a: 'Annual only. Plans renew automatically each year unless you cancel before the renewal date.' },
      ...(taxNotice ? [{ q: 'Is tax added to the price?', a: taxNotice }] : []),
      { q: 'Do you offer refunds?', a: supportEmail ? `LaunchLog has a 7-day money-back guarantee for the initial payment. Requests are reviewed and processed manually in Stripe; email ${supportEmail} within 7 days of purchase.` : 'LaunchLog has a 7-day money-back guarantee for the initial payment. Requests are reviewed and processed manually in Stripe. A public request mailbox has not yet been configured; check the Contact page for current channels.' },
      { q: 'How do I cancel?', a: 'Use your billing settings to manage or cancel the subscription. The listing remains published while Stripe reports the subscription active and is archived when Stripe reports it canceled.' },
    ],
  },
  {
    id: 'tech-edge',
    title: 'The tech edge',
    summary: 'Why LaunchLog pages are built for AI and search.',
    faqs: [
      { q: 'How does LaunchLog support machine-readable discovery?', a: 'Every published listing exposes schema.org JSON-LD, appears in the XML sitemap, and supports content-negotiated markdown. These outputs keep the product facts consistent for crawlers and other compatible systems, without guaranteeing indexing, ranking or citation.' },
      { q: 'What is llms.txt?', a: 'llms.txt is an optional convention used by some non-Google tools as a machine-readable site map. LaunchLog generates llms.txt and llms-full.txt from published content. Google Search states that it ignores these files, so they are not presented as a ranking signal.' },
      { q: 'Does LaunchLog guarantee search or AI results?', a: 'No. LaunchLog provides structured, indexable discovery surfaces, but does not guarantee indexing, traffic, search position or AI citations.' },
    ],
  },
  {
    id: 'account',
    title: 'Account & moderation',
    summary: 'Admin actions and your data.',
    faqs: [
      { q: 'How does moderation work?', a: 'Paid listings publish after successful conversion. An administrator can later edit, unpublish to pending-review status, republish or reject a listing. These actions do not automatically issue refunds or change Stripe disputes.' },
      { q: 'Why was my listing unpublished or rejected?', a: supportEmail ? `An administrator may remove listings that violate the Terms or harm the directory. If you believe an action was mistaken, contact ${supportEmail}.` : 'An administrator may remove listings that violate the Terms or harm the directory. No public support mailbox is currently configured; check the Contact page for current channels.' },
      { q: 'How do I request access to or deletion of my data?', a: legalEmail ? `Send the request to ${legalEmail}. We will handle it under the Privacy Policy and applicable law.` : 'The public legal mailbox is not currently configured. Check the Contact page for the current legal channel.' },
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
  <ContentReadingShell
    wide
    label="Reference desk · Help center"
    title="How can we help?"
    intro="Straight answers about private previews, publication, billing, discovery and account access."
  >
    <template #meta>
      <ContentReadingMeta
        :items="[
        { label: 'Sections', value: String(categories.length) },
        { label: 'Format', value: 'Operational reference' },
        { label: 'Escalation', value: 'Human support' },
        ]"
      />
    </template>

    <div class="space-y-14">
      <section
        v-for="category in categories"
        :id="category.id"
        :key="category.id"
        class="scroll-mt-24 grid gap-7 lg:grid-cols-[16rem_minmax(0,1fr)]"
      >
        <div class="lg:sticky lg:top-24 lg:self-start">
          <p class="release-kicker">{{ category.id.replace('-', ' ') }}</p>
          <h2 class="mt-3 text-2xl font-semibold tracking-tight text-[#f6f1e7]">
            {{ category.title }}
          </h2>
          <p class="mt-3 leading-7 text-release-paper-muted">
            {{ category.summary }}
          </p>
        </div>

        <div class="border-t border-release-seam">
          <details
            v-for="faq in category.faqs"
            :key="faq.q"
            class="group border-b border-release-seam"
          >
            <summary class="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-4 text-base font-semibold text-[#f6f1e7] transition-colors hover:text-release-blaze focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus">
              {{ faq.q }}
              <span class="font-mono text-lg font-normal text-release-blaze" aria-hidden="true">＋</span>
            </summary>
            <div class="max-w-3xl pb-6 pr-8 leading-8 text-release-paper-muted">
              {{ faq.a }}
            </div>
          </details>
        </div>
      </section>
    </div>

    <section class="mt-16 border-y border-release-seam py-9">
      <div class="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p class="release-kicker">Escalation</p>
          <h2 class="mt-3 text-2xl font-semibold tracking-tight text-[#f6f1e7]">Still stuck?</h2>
          <p class="mt-3 max-w-xl leading-7 text-release-paper-muted">
            Use the Contact page to find any support or legal channel that has
            been configured for LaunchLog.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <NuxtLink
            to="/contact"
            class="release-action-secondary"
          >
            Contact us
          </NuxtLink>
          <a
            v-if="supportEmail"
            :href="`mailto:${supportEmail}`"
            class="release-action"
          >
            Email support
          </a>
        </div>
      </div>
    </section>
  </ContentReadingShell>
</template>
