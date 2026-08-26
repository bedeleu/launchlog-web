<script setup lang="ts">
import { CheckCircle2, Send } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ContactTopic } from '~/composables/useContact'

const config = useRuntimeConfig()
const route = useRoute()
const { resetContactForm, sendContactRequest } = useContact()
const { user, waitForAuthReady } = useAuth()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/contact`
const description
  = 'LaunchLog contact channels for listing support, billing, legal requests and copyright notices.'
const legalName = config.public.legalName.trim()
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
  <main class="mx-auto max-w-6xl px-6 py-14 md:py-20">
    <section class="grid gap-10 md:grid-cols-[1fr_0.7fr] md:items-end">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
          Contact
        </p>
        <h1 class="mt-5 max-w-2xl text-4xl font-bold tracking-normal text-white md:text-6xl">
          Talk to a human.
        </h1>
        <p class="mt-6 max-w-xl text-lg leading-8 text-brand-muted">
          Send a support or ownership request without leaving LaunchLog. We route it to the right person.
        </p>
      </div>
      <aside v-if="legalName" class="rounded-lg border border-brand-border bg-white/[0.03] p-6">
        <p class="text-sm font-semibold text-white">Service operator</p>
        <p class="mt-3 leading-7 text-brand-muted">
          {{ legalName }}
        </p>
      </aside>
    </section>

    <section class="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-start">
      <form
        class="rounded-2xl border border-brand-border bg-[linear-gradient(145deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8"
        novalidate
        @submit.prevent="submitRequest"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Send a request</p>
            <h2 class="mt-2 text-2xl font-semibold text-white">How can we help?</h2>
          </div>
          <span class="rounded-full border border-brand-border bg-black/20 px-3 py-1 font-mono text-[11px] text-brand-muted">Manual claim review</span>
        </div>

        <fieldset class="mt-7">
          <legend class="text-sm font-medium text-white">Choose a topic</legend>
          <div class="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              v-for="topic in topics"
              :key="topic.value"
              type="button"
              class="rounded-lg border p-3 text-left transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60"
              :class="form.topic === topic.value
                ? 'border-brand-accent/70 bg-brand-accent/[0.12] shadow-[inset_0_0_0_1px_rgba(99,102,241,0.14)]'
                : 'border-brand-border bg-black/10 hover:border-white/20 hover:bg-white/[0.035]'"
              :aria-pressed="form.topic === topic.value"
              @click="form.topic = topic.value"
            >
              <span class="block text-sm font-semibold text-white">{{ topic.label }}</span>
              <span class="mt-1 block text-xs leading-5 text-brand-muted">{{ topic.hint }}</span>
            </button>
          </div>
        </fieldset>

        <div class="mt-7 grid gap-5 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label for="contact-name">Name</Label>
            <Input id="contact-name" v-model="form.name" autocomplete="name" placeholder="Your name" :aria-invalid="!!fieldErrors.name" />
            <p v-if="fieldErrors.name" class="text-xs text-brand-warning" role="alert">{{ fieldErrors.name }}</p>
          </div>
          <div class="space-y-1.5">
            <Label for="contact-email">Email</Label>
            <Input id="contact-email" v-model="form.email" type="email" autocomplete="email" placeholder="you@company.com" :disabled="!!authenticatedEmail" :aria-invalid="!!fieldErrors.email" />
            <p v-if="authenticatedEmail" class="text-xs text-brand-success">Using your verified account email.</p>
            <p v-else-if="fieldErrors.email" class="text-xs text-brand-warning" role="alert">{{ fieldErrors.email }}</p>
          </div>
          <div class="space-y-1.5 sm:col-span-2">
            <Label for="contact-website">Website <span class="text-brand-muted">{{ form.topic === 'listing_claim' ? '(required)' : '(optional)' }}</span></Label>
            <Input id="contact-website" v-model="form.website" type="url" inputmode="url" autocomplete="url" placeholder="https://yourproduct.com" :aria-invalid="!!fieldErrors.website" />
            <p v-if="fieldErrors.website" class="text-xs text-brand-warning" role="alert">{{ fieldErrors.website }}</p>
          </div>
          <div class="space-y-1.5 sm:col-span-2">
            <Label for="contact-message">Message</Label>
            <textarea
              id="contact-message"
              v-model="form.message"
              rows="5"
              class="min-h-32 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-white outline-none transition-[border-color,box-shadow] placeholder:text-brand-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Tell us what happened and what you need."
              :aria-invalid="!!fieldErrors.message"
            />
            <p v-if="fieldErrors.message" class="text-xs text-brand-warning" role="alert">{{ fieldErrors.message }}</p>
          </div>
        </div>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" size="lg" class="sm:min-w-44" :disabled="isSending || sent">
            <AppSpinner v-if="isSending" class="mr-2" color="text-current" label="Sending request" />
            <CheckCircle2 v-else-if="sent" class="mr-2 size-4" aria-hidden="true" />
            <Send v-else class="mr-2 size-4" aria-hidden="true" />
            {{ sent ? 'Request sent' : isSending ? 'Sending…' : 'Send request' }}
          </Button>
          <p v-if="sent" class="text-sm text-brand-success" role="status">Thanks — your request is in our support queue.</p>
          <p v-else-if="formError" class="text-sm text-brand-warning" role="alert">{{ formError }}</p>
          <p v-else class="text-xs leading-5 text-brand-muted">No automated ownership transfers. A human reviews every claim.</p>
        </div>
      </form>

      <div class="space-y-3">
        <div class="rounded-xl border border-brand-border bg-white/[0.025] p-5">
          <h2 class="text-base font-semibold text-white">What happens next</h2>
          <ol class="mt-4 space-y-4 text-sm text-brand-muted">
            <li class="flex gap-3"><span class="font-mono text-brand-accent">01</span><span>We match the website and existing listing.</span></li>
            <li class="flex gap-3"><span class="font-mono text-brand-accent">02</span><span>For ownership requests, we ask for domain-level proof.</span></li>
            <li class="flex gap-3"><span class="font-mono text-brand-accent">03</span><span>We update access without exposing another account.</span></li>
          </ol>
        </div>
        <a
          v-if="supportEmail"
          :href="`mailto:${supportEmail}`"
          class="block rounded-xl border border-brand-border p-5 transition-colors hover:border-brand-accent/40 hover:bg-white/[0.025]"
        >
          <span class="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">Email alternative</span>
          <span class="mt-2 block break-all font-mono text-sm text-brand-accent">{{ supportEmail }}</span>
        </a>
      </div>
    </section>

    <section v-if="channels.length" class="mt-14 grid gap-4 sm:grid-cols-2" aria-label="Contact channels">
      <a
        v-for="channel in channels"
        :key="channel.email"
        :href="`mailto:${channel.email}`"
        class="group rounded-lg border border-brand-border bg-white/[0.03] p-6 transition-colors hover:border-brand-accent/50 hover:bg-white/[0.05]"
      >
        <div class="flex items-start justify-between gap-4">
          <span class="inline-flex size-10 items-center justify-center rounded-md border border-brand-border bg-brand-accent/10 text-brand-accent">
            <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" :d="channel.icon" />
            </svg>
          </span>
          <svg class="size-4 text-brand-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
        <h2 class="mt-5 text-lg font-semibold text-white">
          {{ channel.label }}
        </h2>
        <p class="mt-2 leading-7 text-brand-muted">
          {{ channel.body }}
        </p>
        <p class="mt-4 font-mono text-sm text-brand-accent">
          {{ channel.email }}
        </p>
      </a>
    </section>

    <section v-else class="mt-14 rounded-lg border border-brand-border bg-white/[0.03] p-6 md:p-8">
      <h2 class="text-xl font-semibold text-white">
        Contact details are not configured
      </h2>
      <p class="mt-3 max-w-2xl leading-7 text-brand-muted">
        No public support, legal or copyright mailbox is currently published on this page.
        The resources below describe the available self-service paths.
      </p>
    </section>

    <section class="mt-16 rounded-lg border border-brand-border p-6 md:p-8">
      <div class="grid gap-8 md:grid-cols-[0.6fr_1fr] md:items-center">
        <div>
          <h2 class="text-2xl font-semibold text-white">
            Before you email
          </h2>
          <p class="mt-3 leading-7 text-brand-muted">
            A lot of questions have a faster answer. These usually get you there
            quicker than the inbox.
          </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <NuxtLink
            v-for="link in quickLinks"
            :key="link.to"
            :to="link.to"
            class="flex items-center justify-between gap-3 rounded-md border border-brand-border px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.04]"
          >
            {{ link.label }}
            <svg class="size-4 shrink-0 text-brand-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </NuxtLink>
        </div>
      </div>
    </section>
  </main>
</template>
