<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/cookies`
const updated = 'August 29, 2026'
const legalEmail = config.public.legalEmail.trim()
const description
  = 'How LaunchLog uses browser storage, optional analytics, optional Meta advertising measurement and Stripe payment cookies.'

const sections = [
  {
    id: 'what',
    title: 'Browser storage in the current app',
    blocks: [
      { type: 'p', text: 'Cookies and local storage are browser technologies used to retain data between page loads. The current LaunchLog web code relies on browser storage for authentication continuity, email-link completion and private-preview drafts.' },
      { type: 'p', text: 'Optional self-hosted Plausible analytics and optional Meta advertising measurement are off until you choose them. Plausible sets no analytics cookies. Meta Pixel may set or read Meta advertising cookies only after advertising consent.' },
    ],
  },
  {
    id: 'local-storage',
    title: 'Local storage and authentication persistence',
    blocks: [
      { type: 'p', text: 'The application currently stores the following browser-side data:' },
      { type: 'list', items: [
        'Firebase Authentication persistence used by the Firebase client SDK to restore sign-in state.',
        'The email entered for an email-link sign-in, removed after the link is completed.',
        'Private-preview drafts, including the preview token, submitted URL, editable listing fields, email, selected tier and expiry time.',
        'The last submitted URL and the selected pricing tier used to resume the preview flow.',
        'Your separate analytics and advertising-measurement choices, stored for up to six months so the site can apply them on later visits.',
      ] },
    ],
  },
  {
    id: 'payments',
    title: 'Payment cookies',
    blocks: [
      { type: 'p', text: 'When you check out, Stripe may set cookies needed to process payments securely and to detect and prevent fraud. These are set by Stripe as part of providing the payment service and are governed by Stripe’s own cookie and privacy notices.' },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    blocks: [
      { type: 'p', text: 'After you accept analytics, LaunchLog sends approved public pageviews and the four existing funnel event names directly to our self-hosted Plausible endpoint. Private routes, tokens, Stripe Session IDs, Reddit click IDs and arbitrary query values are blocked.' },
    ],
  },
  {
    id: 'advertising',
    title: 'Meta advertising measurement',
    blocks: [
      { type: 'p', text: 'After you separately accept advertising measurement, Meta Pixel can measure approved public pageviews. The _fbp cookie distinguishes browsers for advertising measurement; _fbc may preserve a Meta ad click identifier when you arrive from a Meta ad.' },
      { type: 'p', text: 'Consented funnel events are also sent through our server to Meta Conversions API with the same opaque event ID when a matching browser event is eligible. The event source is fixed to the public /submit page; private preview tokens, Stripe Session IDs and submitted listing content are excluded.' },
    ],
  },
  {
    id: 'managing',
    title: 'Managing cookies',
    blocks: [
      { type: 'p', text: 'Use Privacy choices in the footer to accept, reject or later withdraw analytics and advertising measurement separately. Global Privacy Control keeps advertising measurement off. You can also clear LaunchLog site data through your browser settings; doing so can sign you out and remove private-preview drafts. Blocking cookies on Stripe’s hosted pages may affect checkout or billing-portal operation.' },
    ],
  },
  {
    id: 'changes',
    title: 'Changes',
    blocks: [
      { type: 'p', text: 'If we introduce new categories of cookies in the future, we will update this page and, where required, ask for your consent. The "Last updated" date above always reflects the current version.' },
    ],
  },
]

useSeoMeta({
  title: 'Cookie Policy — LaunchLog',
  description,
  ogTitle: 'Cookie Policy — LaunchLog',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'website',
  twitterTitle: 'Cookie Policy — LaunchLog',
  twitterDescription: description,
})

useHead({
  link: [{ rel: 'canonical', href: pageUrl }],
  script: [
    {
      key: 'launchlog-cookies-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'Cookie Policy — LaunchLog',
        description,
        inLanguage: 'en-US',
        dateModified: '2026-08-29',
        isPartOf: { '@id': `${siteUrl}/#website` },
      }),
    },
  ],
})
</script>

<template>
  <LegalDoc
    eyebrow="Legal"
    title="Cookie Policy"
    intro="LaunchLog uses essential browser storage, optional measurement you control, and Stripe-hosted payment cookies."
    :updated="updated"
    :sections="sections"
    :contact-email="legalEmail"
  />
</template>
