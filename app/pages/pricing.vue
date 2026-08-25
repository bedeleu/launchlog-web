<script setup lang="ts">
import { ArrowRight, Bot, Check, FileJson2, Image, Minus, Receipt, Search, ShieldCheck, Sparkles, Zap } from '@lucide/vue'
import { Button } from '@/components/ui/button'

const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const ogImageUrl = `${siteUrl}/og-image.jpg`
const taxNotice = config.public.taxNotice.trim()

useSeoMeta({
  title: 'Pricing | LaunchLog',
  description: 'Simple annual pricing for LaunchLog listings, built for SEO, AI discovery, and launch visibility.',
  ogTitle: 'LaunchLog Pricing — Standard $24.99, Featured $99/year',
  ogDescription: 'Annual LaunchLog listing packages. Pay only when you publish. Every plan ships schema.org structured data and AI-readable pages.',
  ogUrl: `${siteUrl}/pricing`,
  ogImage: ogImageUrl,
  twitterCard: 'summary_large_image',
  twitterTitle: 'LaunchLog Pricing — Standard $24.99, Featured $99/year',
  twitterDescription: 'Annual LaunchLog listing packages. Pay only when you publish. Every plan ships schema.org structured data and AI-readable pages.',
  twitterImage: ogImageUrl,
})

useBreadcrumbs([
  { name: 'Home', path: '/' },
  { name: 'Pricing', path: '/pricing' },
])

const { plans } = usePlans()

const planMeta = {
  basic: {
    eyebrow: 'Get listed',
    summary: 'A polished listing page with real screenshot, structured data, and a direct website link.',
    cta: 'Start Standard preview',
    accent: 'border-brand-border bg-white/[0.025]',
  },
  featured: {
    eyebrow: 'Priority placement',
    summary: 'Everything in Standard, plus the Featured section on directory pages and eligibility for homepage Featured slots.',
    cta: 'Start Featured preview',
    accent: 'border-white/70 bg-white/[0.05] shadow-[0_0_0_1px_rgba(255,255,255,0.12)]',
  },
} as const

const planCards = computed(() =>
  plans.map(plan => ({
    ...plan,
    ...planMeta[plan.tier],
  })),
)

const discoveryItems = [
  {
    icon: Search,
    title: 'Search-engine ready',
    body: 'Every paid listing is designed for crawling: clean SSR page, sitemap inclusion, and IndexNow submission.',
  },
  {
    icon: Bot,
    title: 'LLM-readable by default',
    body: 'Listings are exposed as human pages and machine-friendly markdown so AI assistants can understand them.',
  },
  {
    icon: FileJson2,
    title: 'Structured data graph',
    body: 'Supported product, organization, offer, and breadcrumb schema.org blocks live on the listing page.',
  },
  {
    icon: Image,
    title: 'Persistent visual proof',
    body: 'We capture a real website screenshot and use it across directory cards, previews, and featured placements.',
  },
]

const featureRows = [
  { label: 'Public directory listing', basic: true, featured: true },
  { label: 'Direct website link', basic: true, featured: true },
  { label: 'Real website screenshot', basic: true, featured: true },
  { label: 'Curated title, tagline, and description', basic: true, featured: true },
  { label: 'Schema.org @graph', basic: true, featured: true },
  { label: 'Markdown listing endpoint', basic: true, featured: true },
  { label: 'Included in /llms.txt surfaces', basic: true, featured: true },
  { label: 'Sitemap + IndexNow submission', basic: true, featured: true },
  { label: 'Directory card', basic: 'Standard 1x1 card', featured: 'Editorial double-width card' },
  { label: 'Featured section on directory pages', basic: false, featured: 'Up to 3 per page' },
  { label: 'Featured before Standard on the same page', basic: false, featured: true },
  { label: 'Homepage Featured section', basic: false, featured: 'Up to 3 slots' },
]

const faqs = [
  {
    question: 'Is my position in the directory fixed?',
    answer: 'Your listing stays published for as long as your subscription is active. Position is not fixed: the order within each plan is re-seeded once per day, so it changes over time rather than following a guaranteed rotation or exposure cadence. Within the same directory page, Featured always comes before Standard. Each page shows at most three Featured listings, so Featured listings beyond that carry onto the following pages — a Standard listing on page one can therefore appear before a Featured listing that continues on page two. The homepage Featured section shows up to three Featured listings at a time, so a Featured listing is eligible for one of those slots rather than guaranteed one.',
  },
  {
    question: 'Do I need an account before paying?',
    answer: 'No. Start with your URL, review the generated preview, choose a package, then we create the account after checkout.',
  },
  {
    question: 'What makes LaunchLog different from a normal directory?',
    answer: 'The listing is built for both humans and machines: screenshot, curated copy, schema.org, markdown output, llms.txt surfaces, sitemap, and IndexNow.',
  },
  {
    question: 'Which package should most products choose?',
    answer: 'Standard is the sensible default: a complete, machine-readable listing. Choose Featured when you want promotion — the Featured section on directory pages and eligibility for homepage Featured slots.',
  },
  {
    question: 'Can I preview before paying?',
    answer: 'Yes. The preview is private and free. You pay only when you decide to publish the listing.',
  },
  {
    question: 'How long does the listing stay active?',
    answer: 'Packages are annual. Your listing remains active for the paid year, with renewal handled through Stripe.',
  },
  {
    question: 'Do you offer refunds?',
    answer: 'Yes. LaunchLog includes a 7-day money-back guarantee for paid listings.',
  },
]

// Expose the same visible FAQ as FAQPage structured data (answer-first, citable by search + AI).
useFaqSchema(faqs.map(f => ({ q: f.question, a: f.answer })))
</script>

<template>
  <main class="min-h-screen">
    <section class="border-b border-brand-border">
      <div class="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end lg:py-20">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
            Pricing
          </p>
          <h1 class="mt-5 max-w-3xl text-4xl font-bold tracking-normal text-brand-fg md:text-6xl">
            Simple pricing for products that need to be found.
          </h1>
          <p class="mt-5 max-w-2xl text-lg leading-8 text-brand-muted">
            LaunchLog is not only a directory slot. It is a discoverability package:
            screenshot, structured data, markdown, llms.txt surfaces, and real placement.
          </p>
        </div>

        <div class="grid gap-3 text-sm">
          <div class="rounded-xl border border-brand-border bg-white/[0.025] p-4">
            <div class="flex items-center gap-2 font-semibold text-brand-fg">
              <Sparkles class="size-4 text-brand-accent" />
              Preview before paying
            </div>
            <p class="mt-2 text-brand-muted">
              See the listing placement first. Pay only when you publish.
            </p>
          </div>
          <div class="rounded-xl border border-brand-border bg-white/[0.025] p-4">
            <div class="flex items-center gap-2 font-semibold text-brand-fg">
              <ShieldCheck class="size-4 text-brand-success" />
              7-day guarantee
            </div>
            <p class="mt-2 text-brand-muted">
              Annual packages, no hidden fees, easy refund window.
            </p>
          </div>
          <div v-if="taxNotice" class="rounded-xl border border-brand-border bg-white/[0.025] p-4">
            <div class="flex items-center gap-2 font-semibold text-brand-fg">
              <Receipt class="size-4 text-brand-muted" />
              Tax
            </div>
            <p class="mt-2 text-brand-muted">
              {{ taxNotice }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-6 py-14">
      <!--
        Subgrid: each card spans the same seven parent rows (eyebrow, name,
        summary, price, monthly, features, CTA), so every band shares one
        baseline across both cards no matter how the copy wraps. The
        features row is 1fr, so it absorbs the slack and the CTA always sits on
        the bottom edge.
      -->
      <div class="grid gap-5 lg:grid-cols-2 lg:grid-rows-[auto_auto_auto_auto_auto_1fr_auto]">
        <article
          v-for="plan in planCards"
          :key="plan.tier"
          class="relative flex flex-col rounded-xl border p-6 lg:row-span-7 lg:grid lg:grid-rows-subgrid"
          :class="plan.accent"
        >
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
            {{ plan.eyebrow }}
          </p>
          <h2 class="mt-5 text-2xl font-bold text-brand-fg">
            {{ plan.name }}
          </h2>
          <p class="mt-3 text-sm leading-6 text-brand-muted">
            {{ plan.summary }}
          </p>

          <div class="mt-6 flex items-end gap-2">
            <span class="text-4xl font-bold text-brand-fg">{{ plan.priceLabel }}</span>
            <span class="pb-1 text-sm text-brand-muted">/ year</span>
          </div>
          <p class="mt-1 text-sm text-brand-muted">
            That's {{ plan.monthlyLabel }}/month, billed annually.
          </p>

          <ul class="mt-7 space-y-3 text-sm text-brand-muted">
            <li v-for="feature in plan.features" :key="feature" class="flex gap-2">
              <Check class="mt-0.5 size-4 shrink-0 text-brand-accent" />
              <span>{{ feature }}</span>
            </li>
          </ul>

          <Button as-child size="lg" class="mt-auto w-full lg:mt-7">
            <NuxtLink :to="`/submit?tier=${plan.tier}`" class="group">
              {{ plan.cta }}
              <ArrowRight class="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
            </NuxtLink>
          </Button>
        </article>
      </div>
    </section>

    <section class="border-y border-brand-border bg-white/[0.018]">
      <div class="mx-auto max-w-6xl px-6 py-14">
        <div class="max-w-2xl">
          <p class="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
            What you get
          </p>
          <h2 class="mt-4 text-3xl font-bold text-brand-fg">
            Built for SEO and AI discovery, not just a backlink.
          </h2>
        </div>

        <div class="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <article
            v-for="item in discoveryItems"
            :key="item.title"
            class="rounded-xl border border-brand-border bg-brand-bg p-5"
          >
            <component :is="item.icon" class="size-5 text-brand-accent" />
            <h3 class="mt-4 font-semibold text-brand-fg">
              {{ item.title }}
            </h3>
            <p class="mt-2 text-sm leading-6 text-brand-muted">
              {{ item.body }}
            </p>
          </article>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-6 py-14">
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
            Compare plans
          </p>
          <h2 class="mt-4 text-3xl font-bold text-brand-fg">
            Choose by visibility level.
          </h2>
        </div>
        <NuxtLink to="/" class="inline-flex items-center gap-2 text-sm font-semibold text-brand-accent hover:underline">
          Start with a free preview
          <ArrowRight class="size-4" />
        </NuxtLink>
      </div>

      <div class="overflow-x-auto rounded-xl border border-brand-border">
        <table class="w-full min-w-[760px] border-collapse text-sm">
          <thead class="bg-white/[0.03] text-left text-xs uppercase tracking-[0.18em] text-brand-muted">
            <tr>
              <th class="w-[42%] px-5 py-4 font-semibold">
                Feature
              </th>
              <th v-for="plan in plans" :key="plan.tier" class="px-5 py-4 text-center font-semibold">
                {{ plan.name }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in featureRows" :key="row.label" class="border-t border-brand-border">
              <td class="px-5 py-4 font-medium text-brand-fg">
                {{ row.label }}
              </td>
              <td
                v-for="plan in plans"
                :key="`${row.label}-${plan.tier}`"
                class="px-5 py-4 text-center text-brand-muted"
              >
                <Check
                  v-if="row[plan.tier] === true"
                  class="mx-auto size-4 text-brand-success"
                />
                <Minus
                  v-else-if="row[plan.tier] === false"
                  class="mx-auto size-4 text-brand-muted/60"
                />
                <span v-else>{{ row[plan.tier] }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="border-t border-brand-border">
      <div class="mx-auto max-w-6xl px-6 py-14">
        <div class="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div>
            <p class="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
              FAQ
            </p>
            <h2 class="mt-4 text-3xl font-bold text-brand-fg">
              Straight answers before checkout.
            </h2>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <article v-for="faq in faqs" :key="faq.question" class="rounded-xl border border-brand-border bg-white/[0.025] p-5">
              <h3 class="font-semibold text-brand-fg">
                {{ faq.question }}
              </h3>
              <p class="mt-2 text-sm leading-6 text-brand-muted">
                {{ faq.answer }}
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-6 pb-16">
      <div class="flex flex-col gap-4 rounded-xl border border-brand-accent/40 bg-brand-accent/10 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-xl font-bold text-brand-fg">
            See your listing before you pay.
          </h2>
          <p class="mt-1 text-sm text-brand-muted">
            Paste your URL, get a private preview, then choose the package that fits your launch.
          </p>
        </div>
        <Button as-child size="lg" class="shrink-0">
          <NuxtLink to="/">
            Generate preview
            <Zap class="ml-1 size-4" />
          </NuxtLink>
        </Button>
      </div>
    </section>
  </main>
</template>
