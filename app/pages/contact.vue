<script setup lang="ts">
import { CheckCircle2, Send } from '@lucide/vue'
import type { ContactTopic } from '~/composables/useContact'

const config = useRuntimeConfig()
const route = useRoute()
const { resetContactForm, sendContactRequest } = useContact()
const { user, waitForAuthReady } = useAuth()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/contact`
const description
  = 'LaunchLog contact channels for listing support, billing, legal requests and copyright notices.'
const operatorBrand = config.public.operatorBrand.trim()
const legalName = config.public.legalName.trim()
const legalAddress = config.public.legalAddress.trim()
const legalRegistrationId = config.public.legalRegistrationId.trim()
const legalTaxId = String(config.public.legalTaxId ?? '').trim()
const legalShareCapital = config.public.legalShareCapital.trim()
const legalPhone = config.public.legalPhone.trim()
const supportEmail = config.public.supportEmail.trim()
const legalEmail = config.public.legalEmail.trim()
const dmcaEmail = config.public.dmcaEmail.trim()

const topics: Array<{ value: ContactTopic, label: string, hint: string }> = [
  { value: 'listing_claim', label: 'Claim a listing', hint: 'Verify ownership or correct an existing listing.' },
  { value: 'support', label: 'Product support', hint: 'Get help with your account or a listing.' },
  { value: 'billing', label: 'Billing', hint: 'Questions about payment, cancellation or refunds.' },
  { value: 'general', label: 'Something else', hint: 'Partnerships, feedback or another request.' },
]
const isContactTopic = (value: unknown): value is ContactTopic =>
  typeof value === 'string' && topics.some(topic => topic.value === value)
const initialTopic: ContactTopic = isContactTopic(route.query.topic) ? route.query.topic : 'support'
const initialWebsite = typeof route.query.website === 'string' ? route.query.website : ''

const form = reactive({
  topic: initialTopic,
  name: '',
  email: '',
  website: initialWebsite,
  message: initialTopic === 'listing_claim'
    ? 'I would like to verify ownership of this website and manage its LaunchLog listing.'
    : '',
})
const authReady = ref(false)
const isSending = ref(false)
const sent = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = reactive({ name: '', email: '', website: '', message: '' })
const authenticatedEmail = computed(() => authReady.value ? user.value?.email?.trim() || null : null)

onMounted(() => {
  void waitForAuthReady().finally(() => {
    authReady.value = true
    if (user.value?.email) form.email = user.value.email
  })
})

const validate = () => {
  Object.assign(fieldErrors, { name: '', email: '', website: '', message: '' })
  if (form.name.trim().length < 2) fieldErrors.name = 'Enter your name.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) fieldErrors.email = 'Enter a valid email.'
  if (form.topic === 'listing_claim' && !/^https?:\/\/[^\s]+$/i.test(form.website.trim())) {
    fieldErrors.website = 'Enter the website you want to claim, including https://.'
  }
  if (form.message.trim().length < 20) fieldErrors.message = 'Enter at least 20 characters so we can understand the request.'
  return !Object.values(fieldErrors).some(Boolean)
}

const submitRequest = async () => {
  sent.value = false
  formError.value = null
  if (!validate() || isSending.value) return

  isSending.value = true
  try {
    await sendContactRequest({
      topic: form.topic,
      name: form.name.trim(),
      email: form.email.trim(),
      website: form.website.trim(),
      message: form.message.trim(),
    })
    resetContactForm(form, authenticatedEmail.value)
    sent.value = true
  }
  catch (error: unknown) {
    const response = error as { data?: { message?: string, errors?: Record<string, string[]> } }
    for (const field of ['name', 'email', 'website', 'message'] as const) {
      const message = response.data?.errors?.[field]?.[0]
      if (message) fieldErrors[field] = message
    }
    formError.value = response.data?.message ?? 'We could not send your request. Please try again.'
  }
  finally {
    isSending.value = false
  }
}

const channels = computed(() => [
  supportEmail ? {
    label: 'Support',
    email: supportEmail,
    body: 'Help with an existing listing, account access, billing or technical issues.',
    icon: 'M18.364 5.636A9 9 0 105.636 18.364 9 9 0 0018.364 5.636zM12 8v4m0 4h.01',
  } : null,
  legalEmail ? {
    label: 'Legal & privacy',
    email: legalEmail,
    body: 'Privacy requests, data-rights requests and questions about the legal terms.',
    icon: 'M12 3l8 4v5c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7l8-4z',
  } : null,
  dmcaEmail ? {
    label: 'Copyright notices',
    email: dmcaEmail,
    body: 'Copyright notices and counter-notices concerning content hosted by LaunchLog.',
    icon: 'M3 8l9 6 9-6M3 8v8a2 2 0 002 2h14a2 2 0 002-2V8M3 8l9-5 9 5',
  } : null,
].filter((channel): channel is NonNullable<typeof channel> => channel !== null))

const quickLinks = [
  { label: 'Browse the Help Center', to: '/help' },
  { label: 'Check system status', to: '/status' },
  { label: 'Preview a listing for free', to: '/submit' },
  { label: 'See pricing', to: '/pricing' },
]

const legalDetails = computed(() => [
  legalName ? { label: 'Contracting provider', value: legalName } : null,
  legalAddress ? { label: 'Registered address', value: legalAddress } : null,
  legalRegistrationId ? { label: 'Registration', value: legalRegistrationId } : null,
  legalTaxId ? { label: 'Tax ID', value: legalTaxId } : null,
  legalShareCapital ? { label: 'Share capital', value: legalShareCapital } : null,
  legalPhone ? { label: 'Telephone', value: legalPhone } : null,
].filter((detail): detail is NonNullable<typeof detail> => detail !== null))

useSeoMeta({
  title: 'Contact LaunchLog',
  description,
  ogTitle: 'Contact LaunchLog',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'website',
  twitterTitle: 'Contact LaunchLog',
  twitterDescription: description,
})

useHead({
  link: [{ rel: 'canonical', href: pageUrl }],
  script: [
    {
      key: 'launchlog-contact-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'Contact LaunchLog',
        description,
        inLanguage: 'en-US',
        isPartOf: { '@id': `${siteUrl}/#website` },
      }),
    },
  ],
})
</script>

<template>
  <ContentReadingShell
    wide
    label="Support desk · Manual verification"
    title="Talk to a human."
    intro="Send a support, billing or ownership request without leaving LaunchLog. Every claim is reviewed before access changes."
  >
    <template #meta>
      <ContentReadingMeta
        :items="[
        { label: 'Operator', value: operatorBrand || 'AB Solutions' },
        { label: 'Channel', value: 'Support request' },
        { label: 'Ownership', value: 'Manual verification' },
        ]"
      />
    </template>

    <section class="grid border-y border-release-seam lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form class="py-8 lg:border-r lg:border-release-seam lg:pr-10" novalidate @submit.prevent="submitRequest">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p class="release-kicker">Request file</p>
            <h2 class="mt-3 text-3xl font-semibold tracking-tight text-[#f6f1e7]">How can we help?</h2>
          </div>
          <span class="font-mono text-[11px] uppercase tracking-[0.12em] text-release-paper-muted">Human approval required</span>
        </div>

        <fieldset class="mt-8">
          <legend class="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-release-paper-muted">Request type</legend>
          <div class="mt-3 grid border-t border-l border-release-seam sm:grid-cols-2">
            <button
              v-for="topic in topics"
              :key="topic.value"
              type="button"
              class="min-h-24 border-r border-b border-release-seam p-4 text-left transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-release-focus"
              :class="form.topic === topic.value ? 'bg-release-paper text-release-ink' : 'bg-release-rail text-[#f6f1e7] hover:bg-[#171a15]'"
              :aria-pressed="form.topic === topic.value"
              @click="form.topic = topic.value"
            >
              <span class="block text-sm font-semibold">{{ topic.label }}</span>
              <span class="mt-1 block text-xs leading-5" :class="form.topic === topic.value ? 'text-release-ink/70' : 'text-release-paper-muted'">{{ topic.hint }}</span>
            </button>
          </div>
        </fieldset>

        <div class="mt-8 grid gap-5 sm:grid-cols-2">
          <div>
            <label for="contact-name" class="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-release-paper-muted">Name</label>
            <input id="contact-name" v-model="form.name" class="release-field mt-2 h-12 px-3 text-sm" autocomplete="name" placeholder="Your name" :aria-invalid="!!fieldErrors.name">
            <p v-if="fieldErrors.name" class="mt-2 text-xs text-release-blaze" role="alert">{{ fieldErrors.name }}</p>
          </div>
          <div>
            <label for="contact-email" class="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-release-paper-muted">Email</label>
            <input id="contact-email" v-model="form.email" class="release-field mt-2 h-12 px-3 text-sm" type="email" autocomplete="email" placeholder="you@company.com" :disabled="!!authenticatedEmail" :aria-invalid="!!fieldErrors.email">
            <p v-if="authenticatedEmail" class="mt-2 text-xs text-release-signal">Verified account email</p>
            <p v-else-if="fieldErrors.email" class="mt-2 text-xs text-release-blaze" role="alert">{{ fieldErrors.email }}</p>
          </div>
          <div class="sm:col-span-2">
            <label for="contact-website" class="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-release-paper-muted">Website · {{ form.topic === 'listing_claim' ? 'Required' : 'Optional' }}</label>
            <input id="contact-website" v-model="form.website" class="release-field mt-2 h-12 px-3 text-sm" type="url" inputmode="url" autocomplete="url" placeholder="https://yourproduct.com" :aria-invalid="!!fieldErrors.website">
            <p v-if="fieldErrors.website" class="mt-2 text-xs text-release-blaze" role="alert">{{ fieldErrors.website }}</p>
          </div>
          <div class="sm:col-span-2">
            <label for="contact-message" class="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-release-paper-muted">Message</label>
            <textarea id="contact-message" v-model="form.message" rows="6" class="release-field mt-2 min-h-36 resize-y px-3 py-3 text-sm leading-6" placeholder="Tell us what happened and what you need." :aria-invalid="!!fieldErrors.message" />
            <p v-if="fieldErrors.message" class="mt-2 text-xs text-release-blaze" role="alert">{{ fieldErrors.message }}</p>
          </div>
        </div>

        <div id="contact-privacy-notice" class="mt-6 border-l-2 border-release-signal bg-release-rail px-4 py-3 text-xs leading-5 text-release-paper-muted">
          <p>
            We use the required name, email and message to review and answer this request. If you do not provide them, we cannot submit or respond to it. Website is optional except for listing claims. See our
            <NuxtLink to="/privacy" class="text-release-blaze underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-release-focus">Privacy Policy</NuxtLink>.
          </p>
          <p class="mt-1">Do not include passwords, payment-card details or private access tokens.</p>
        </div>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="submit" class="release-action sm:min-w-44" :disabled="isSending || sent">
            <AppSpinner v-if="isSending" color="text-current" label="Sending request" />
            <CheckCircle2 v-else-if="sent" class="size-4" aria-hidden="true" />
            <Send v-else class="size-4" aria-hidden="true" />
            {{ sent ? 'Request sent' : isSending ? 'Sending…' : 'Send request' }}
          </button>
          <div class="min-h-10 flex-1" aria-live="polite">
            <p v-if="sent" class="text-sm leading-6 text-release-signal" role="status">Thanks — your request is in our support queue.</p>
            <p v-else-if="formError" class="text-sm leading-6 text-release-blaze" role="alert">{{ formError }}</p>
            <p v-else class="text-xs leading-5 text-release-paper-muted">No automated ownership transfers. A human reviews every claim.</p>
          </div>
        </div>
      </form>

      <aside class="py-8 lg:pl-8">
        <p class="release-kicker">Verification route</p>
        <ol class="mt-5 border-t border-release-seam">
          <li v-for="(step, index) in ['We match the website and existing listing.', 'We request domain-level proof when ownership is involved.', 'We update access without exposing another account.']" :key="step" class="grid grid-cols-[2rem_1fr] gap-3 border-b border-release-seam py-4 text-sm leading-6 text-release-paper-muted">
            <span class="font-mono text-release-blaze">0{{ index + 1 }}</span><span>{{ step }}</span>
          </li>
        </ol>
        <a v-if="supportEmail" :href="`mailto:${supportEmail}`" class="mt-7 block border-l-2 border-release-blaze bg-release-rail px-4 py-4">
          <span class="release-kicker">Email alternative</span>
          <span class="mt-2 block break-all font-mono text-xs text-[#f6f1e7]">{{ supportEmail }}</span>
        </a>
      </aside>
    </section>

    <section v-if="channels.length" class="mt-14" aria-label="Contact channels">
      <p class="release-kicker">Published channels</p>
      <div class="mt-5 grid border-t border-l border-release-seam sm:grid-cols-2">
        <a v-for="channel in channels" :key="channel.email" :href="`mailto:${channel.email}`" class="group border-r border-b border-release-seam p-6 transition-colors hover:bg-release-rail focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-release-focus">
          <span class="font-mono text-[11px] uppercase tracking-[0.12em] text-release-paper-muted">{{ channel.label }}</span>
          <p class="mt-4 leading-7 text-[#f6f1e7]">{{ channel.body }}</p>
          <p class="mt-4 break-all font-mono text-xs text-release-blaze group-hover:underline">{{ channel.email }}</p>
        </a>
      </div>
    </section>

    <section v-if="legalDetails.length" class="mt-14" aria-labelledby="legal-identity-heading">
      <p class="release-kicker">Legal identity</p>
      <h2 id="legal-identity-heading" class="mt-4 text-2xl font-semibold tracking-tight text-[#f6f1e7]">
        {{ operatorBrand || 'AB Solutions' }}
      </h2>
      <dl class="mt-5 grid border-t border-l border-release-seam sm:grid-cols-2">
        <div v-for="detail in legalDetails" :key="detail.label" class="border-r border-b border-release-seam p-5">
          <dt class="font-mono text-[11px] uppercase tracking-[0.12em] text-release-paper-muted">{{ detail.label }}</dt>
          <dd class="mt-2 text-sm leading-6 text-[#f6f1e7]">{{ detail.value }}</dd>
        </div>
      </dl>
    </section>

    <section v-else class="release-panel mt-14 p-6 md:p-8">
      <h2 class="text-xl font-semibold text-[#f6f1e7]">Contact details are not configured</h2>
      <p class="mt-3 max-w-2xl leading-7 text-release-paper-muted">No public support, legal or copyright mailbox is currently published on this page.</p>
    </section>

    <section class="mt-14 grid gap-7 border-y border-release-seam py-9 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div>
        <p class="release-kicker">Self-service index</p>
        <h2 class="mt-4 text-2xl font-semibold tracking-tight text-[#f6f1e7]">Before you send a request.</h2>
      </div>
      <nav class="grid border-t border-l border-release-seam sm:grid-cols-2" aria-label="Support resources">
        <NuxtLink v-for="link in quickLinks" :key="link.to" :to="link.to" class="flex min-h-14 items-center justify-between gap-3 border-r border-b border-release-seam px-4 py-3 text-sm font-medium text-[#f6f1e7] hover:bg-release-rail focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-release-focus">
          {{ link.label }}<span class="font-mono text-release-blaze" aria-hidden="true">→</span>
        </NuxtLink>
      </nav>
    </section>
  </ContentReadingShell>
</template>
