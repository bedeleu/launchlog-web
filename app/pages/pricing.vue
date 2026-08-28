<script setup lang="ts">
import { ArrowRight, Check, FileJson2, Image, Minus, Search, ShieldCheck } from '@lucide/vue'

const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const ogImageUrl = `${siteUrl}/og-image.jpg`
const taxNotice = config.public.taxNotice.trim()

useSeoMeta({
  title: 'Pricing | LaunchLog',
  description: 'Simple annual pricing for LaunchLog product pages, directory placement and machine-readable discovery surfaces.',
  ogTitle: 'LaunchLog Pricing — Standard $24.99, Featured $99/year',
  ogDescription: 'Annual LaunchLog listing packages. Pay only when you publish. Every plan includes a structured public product page.',
  ogUrl: `${siteUrl}/pricing`,
  ogImage: ogImageUrl,
  twitterCard: 'summary_large_image',
  twitterTitle: 'LaunchLog Pricing — Standard $24.99, Featured $99/year',
  twitterDescription: 'Annual LaunchLog listing packages. Pay only when you publish. Every plan includes a structured public product page.',
  twitterImage: ogImageUrl,
})

useBreadcrumbs([
  { name: 'Home', path: '/' },
  { name: 'Pricing', path: '/pricing' },
])

const { plans } = usePlans()

const planMeta = {
  basic: {
    accession: 'LL-STD-01',
    register: 'Standard edition',
    summary: 'A polished listing page with real screenshot, structured data, and a direct website link.',
    cta: 'Start Standard preview',
  },
  featured: {
    accession: 'LL-FTR-02',
    register: 'Priority placement',
    summary: 'Everything in Standard, plus the Featured section on directory pages and eligibility for homepage Featured slots.',
    cta: 'Start Featured preview',
  },
} as const

const planCards = computed(() => plans.map(plan => ({ ...plan, ...planMeta[plan.tier] })))

const discoveryItems = [
  { index: '01', icon: Search, title: 'Search-engine ready', body: 'Every paid listing is designed for crawling: clean SSR page, sitemap inclusion, and IndexNow submission.' },
  { index: '02', icon: FileJson2, title: 'Machine-readable record', body: 'Listings are exposed as visible HTML and content-negotiated markdown with consistent product facts.' },
  { index: '03', icon: ShieldCheck, title: 'Structured data graph', body: 'Supported product, organization, offer, and breadcrumb schema.org blocks live on the listing page.' },
  { index: '04', icon: Image, title: 'Persistent visual proof', body: 'We capture a real website screenshot and use it across directory cards, previews, and featured placements.' },
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
  { question: 'Do I need an account before paying?', answer: 'No. Start with your URL, review the generated preview, choose a package, then we create the account after checkout.' },
  { question: 'What makes LaunchLog different from a normal directory?', answer: 'The listing is built for both humans and machines: screenshot, curated copy, schema.org, markdown output, llms.txt surfaces, sitemap, and IndexNow.' },
  { question: 'Which package should most products choose?', answer: 'Standard is the sensible default: a complete, machine-readable listing. Choose Featured when you want promotion — the Featured section on directory pages and eligibility for homepage Featured slots.' },
  { question: 'Can I preview before paying?', answer: 'Yes. The preview is private and free. You pay only when you decide to publish the listing.' },
  { question: 'How long does the listing stay active?', answer: 'Packages are annual. Your listing remains active for the paid year, with renewal handled through Stripe.' },
  { question: 'Do you offer refunds?', answer: 'Yes. LaunchLog includes a 7-day money-back guarantee for paid listings.' },
]

useFaqSchema(faqs.map(f => ({ q: f.question, a: f.answer })))
</script>

<template>
  <main class="min-h-screen bg-release-ink">
    <ReleaseShell
      eyebrow="Release catalog · placement"
      title="Choose how your release enters the catalog."
      description="One annual placement. A permanent public record for people, search engines, and machine-readable discovery. Preview first; pay only when you publish."
    >
      <section aria-labelledby="placement-editions">
        <div class="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-release-seam pb-3">
          <div>
            <p class="font-mono text-[0.65rem] font-semibold tracking-[0.2em] text-release-warning uppercase">01 — Placement editions</p>
            <h2 id="placement-editions" class="mt-2 text-2xl font-semibold tracking-[-0.025em] text-release-paper">Two ways into the same public catalog</h2>
          </div>
          <p class="max-w-sm text-sm leading-6 text-release-paper-muted">Standard is the complete record. Featured adds promotional placement without changing the evidence contract.</p>
        </div>

        <div class="grid border border-release-seam lg:grid-cols-2">
          <article
            v-for="(plan, index) in planCards"
            :key="plan.tier"
            class="flex min-w-0 flex-col bg-release-ink"
            :class="index ? 'border-t border-release-seam lg:border-t-0 lg:border-l' : ''"
          >
            <header class="flex items-start justify-between gap-4 border-b border-release-seam bg-release-rail px-5 py-4 sm:px-6">
              <div>
                <p class="font-mono text-[0.62rem] font-semibold tracking-[0.18em] text-release-paper-muted uppercase">{{ plan.accession }} · {{ plan.register }}</p>
                <h3 class="mt-2 text-2xl font-semibold tracking-[-0.03em] text-release-paper">{{ plan.name }}</h3>
              </div>
              <span v-if="plan.badge" class="border border-release-paper px-2.5 py-1 font-mono text-[0.58rem] font-semibold tracking-[0.13em] text-release-paper uppercase">{{ plan.badge }}</span>
            </header>

            <div class="flex flex-1 flex-col px-5 py-6 sm:px-6">
              <p class="min-h-12 text-sm leading-6 text-release-paper-muted">{{ plan.summary }}</p>
              <div class="mt-6 flex items-end justify-between gap-4 border-y border-release-seam py-4">
                <div>
                  <span class="text-4xl font-semibold tracking-[-0.045em] text-release-paper">{{ plan.priceLabel }}</span>
                  <span class="ml-2 font-mono text-xs uppercase tracking-[0.08em] text-release-paper-muted">/ year</span>
                </div>
                <p class="max-w-32 text-right font-mono text-[0.65rem] leading-5 text-release-paper-muted">That's {{ plan.monthlyLabel }}/month, billed annually.</p>
              </div>
              <ul class="divide-y divide-release-seam text-sm text-release-paper-muted">
                <li v-for="feature in plan.features" :key="feature" class="flex gap-3 py-3">
                  <Check class="mt-0.5 size-4 shrink-0 text-release-signal" :stroke-width="2.5" />
                  <span>{{ feature }}</span>
                </li>
              </ul>
              <NuxtLink
                :to="`/submit?tier=${plan.tier}`"
                class="mt-auto inline-flex min-h-12 items-center justify-between border border-release-paper bg-release-paper px-4 font-mono text-xs font-semibold tracking-[0.08em] text-release-ink uppercase transition-colors hover:border-release-warning hover:bg-release-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus focus-visible:ring-offset-2 focus-visible:ring-offset-release-ink"
              >
                {{ plan.cta }}
                <ArrowRight class="size-4" />
              </NuxtLink>
            </div>
          </article>
        </div>
      </section>

      <section class="mt-12" aria-labelledby="catalog-evidence">
        <div class="border-b border-release-seam pb-3">
          <p class="font-mono text-[0.65rem] font-semibold tracking-[0.2em] text-release-warning uppercase">02 — Catalog evidence</p>
          <h2 id="catalog-evidence" class="mt-2 text-2xl font-semibold tracking-[-0.025em] text-release-paper">Every edition records the same verifiable facts</h2>
        </div>
        <div class="mt-4 grid border border-release-seam sm:grid-cols-2">
          <article
            v-for="(item, index) in discoveryItems"
            :key="item.title"
            class="grid grid-cols-[3rem_minmax(0,1fr)] bg-release-rail"
            :class="[index > 0 ? 'border-t border-release-seam sm:border-t-0' : '', index % 2 ? 'sm:border-l sm:border-release-seam' : '', index > 1 ? 'sm:border-t sm:border-release-seam' : '']"
          >
            <div class="flex flex-col items-center gap-3 border-r border-release-seam py-4">
              <span class="font-mono text-[0.62rem] text-release-paper-muted">{{ item.index }}</span>
              <component :is="item.icon" class="size-4 text-release-blaze" />
            </div>
            <div class="p-4">
              <h3 class="font-semibold text-release-paper">{{ item.title }}</h3>
              <p class="mt-2 text-sm leading-6 text-release-paper-muted">{{ item.body }}</p>
            </div>
          </article>
        </div>
      </section>

      <section class="mt-12" aria-labelledby="edition-comparison">
        <div class="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-release-seam pb-3">
          <div>
            <p class="font-mono text-[0.65rem] font-semibold tracking-[0.2em] text-release-warning uppercase">03 — Edition comparison</p>
            <h2 id="edition-comparison" class="mt-2 text-2xl font-semibold tracking-[-0.025em] text-release-paper">Compare the placement contract</h2>
          </div>
          <NuxtLink to="/" class="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.08em] text-release-blaze uppercase hover:text-release-paper">
            Start with a free preview
            <ArrowRight class="size-4" />
          </NuxtLink>
        </div>
        <div class="overflow-x-auto border border-release-seam">
          <table class="w-full min-w-[760px] border-collapse text-sm">
            <thead class="bg-release-paper text-left font-mono text-[0.65rem] uppercase tracking-[0.16em] text-release-ink">
              <tr>
                <th class="w-[42%] px-5 py-4 font-semibold">Recorded feature</th>
                <th v-for="plan in plans" :key="plan.tier" class="border-l border-release-ink/20 px-5 py-4 text-center font-semibold">{{ plan.name }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in featureRows" :key="row.label" class="border-t border-release-seam bg-release-rail">
                <td class="px-5 py-4 font-medium text-release-paper">{{ row.label }}</td>
                <td v-for="plan in plans" :key="`${row.label}-${plan.tier}`" class="border-l border-release-seam px-5 py-4 text-center text-release-paper-muted">
                  <Check v-if="row[plan.tier] === true" class="mx-auto size-4 text-release-signal" />
                  <Minus v-else-if="row[plan.tier] === false" class="mx-auto size-4 text-release-paper-muted" />
                  <span v-else>{{ row[plan.tier] }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="mt-12" aria-labelledby="pricing-faq">
        <div class="border-b border-release-seam pb-3">
          <p class="font-mono text-[0.65rem] font-semibold tracking-[0.2em] text-release-warning uppercase">04 — Checkout notes</p>
          <h2 id="pricing-faq" class="mt-2 text-2xl font-semibold tracking-[-0.025em] text-release-paper">Straight answers before checkout</h2>
        </div>
        <div class="mt-4 border border-release-seam divide-y divide-release-seam">
          <article v-for="(faq, index) in faqs" :key="faq.question" class="grid gap-3 bg-release-rail px-4 py-5 sm:grid-cols-[3rem_minmax(0,1fr)] sm:px-5">
            <span class="font-mono text-[0.65rem] text-release-paper-muted">{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <h3 class="font-semibold text-release-paper">{{ faq.question }}</h3>
              <p class="mt-2 max-w-4xl text-sm leading-6 text-release-paper-muted">{{ faq.answer }}</p>
            </div>
          </article>
        </div>
      </section>

      <template #rail>
        <ReleaseActionRail
          step="Before checkout"
          title="Preview the release first"
          description="Paste one public URL. Review the captured website and generated facts before choosing either placement."
        >
          <dl class="divide-y divide-release-seam border-y border-release-seam text-sm">
            <div class="flex items-start justify-between gap-4 py-3"><dt class="text-release-paper-muted">Payment</dt><dd class="text-right font-medium text-release-paper">Only when you publish</dd></div>
            <div class="flex items-start justify-between gap-4 py-3"><dt class="text-release-paper-muted">Billing</dt><dd class="text-right font-medium text-release-paper">Annual</dd></div>
            <div class="flex items-start justify-between gap-4 py-3"><dt class="font-medium text-release-paper">7-day guarantee</dt><dd class="max-w-36 text-right text-release-paper-muted">Annual packages, no hidden fees, easy refund window.</dd></div>
          </dl>
          <div v-if="taxNotice" data-tax-notice class="border border-release-seam border-l-2 border-l-release-warning bg-release-ink p-4">
            <p class="font-mono text-[0.62rem] font-semibold tracking-[0.16em] text-release-warning uppercase">Tax notice</p>
            <p class="mt-2 text-sm leading-6 text-release-paper-muted">{{ taxNotice }}</p>
          </div>
          <ReleaseStateMarker state="success" label="Private preview" detail="Nothing publishes until you approve it." />
          <template #footer>
            <NuxtLink to="/" class="inline-flex min-h-12 w-full items-center justify-between border border-release-paper bg-release-paper px-4 font-mono text-xs font-semibold tracking-[0.08em] text-release-ink uppercase transition-colors hover:border-release-warning hover:bg-release-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus">
              Generate preview
              <ArrowRight class="size-4" />
            </NuxtLink>
          </template>
        </ReleaseActionRail>
      </template>
    </ReleaseShell>
  </main>
</template>
