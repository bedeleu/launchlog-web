<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/cookies`
const updated = 'August 2, 2026'
const legalEmail = config.public.legalEmail.trim()
const description
  = 'How the current LaunchLog web application uses browser storage and how Stripe may use cookies during hosted checkout and billing.'

const sections = [
  {
    id: 'what',
    title: 'Browser storage in the current app',
    blocks: [
      { type: 'p', text: 'Cookies and local storage are browser technologies used to retain data between page loads. The current LaunchLog web code relies on browser storage for authentication continuity, email-link completion and private-preview drafts.' },
      { type: 'p', text: 'The application includes no advertising tracker. It uses Plausible Analytics, a first-party, cookieless analytics script that sets no cookies.' },
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
      { type: 'p', text: 'The application loads Plausible Analytics from a first-party subdomain. It is cookieless and privacy-preserving: it sets no cookies and requires no consent banner.' },
    ],
  },
  {
    id: 'managing',
    title: 'Managing cookies',
    blocks: [
      { type: 'p', text: 'You can clear LaunchLog site data through your browser settings. Doing so can sign you out, remove the saved email-link address and delete locally saved preview drafts. Blocking cookies on Stripe’s hosted pages may affect checkout or billing-portal operation.' },
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
        dateModified: '2026-08-02',
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
    intro="The current web app uses browser storage for sign-in continuity and private-preview drafts. Stripe may use cookies on its hosted checkout and billing pages."
    :updated="updated"
    :sections="sections"
    :contact-email="legalEmail"
  />
</template>
