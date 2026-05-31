<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/cookies`
const updated = 'May 31, 2026'
const description
  = 'How LaunchLog uses cookies and local storage. We keep it minimal — essential cookies for sign-in and security, cookieless analytics, and no advertising trackers.'

const sections = [
  {
    id: 'what',
    title: 'What cookies are',
    blocks: [
      { type: 'p', text: 'Cookies and similar technologies (such as local storage) are small pieces of data stored by your browser. They let a site remember things like whether you are signed in. This page explains which we use and why.' },
      { type: 'p', text: 'LaunchLog takes a minimal approach: we use cookies that are essential to operate the Service and we do not use advertising or cross-site tracking cookies.' },
    ],
  },
  {
    id: 'essential',
    title: 'Essential cookies',
    blocks: [
      { type: 'p', text: 'These are required for the site to function and cannot be switched off in our system. They include:' },
      { type: 'list', items: [
        'Authentication and session — set by Firebase Authentication to keep you securely signed in.',
        'Security — to protect against fraud and abuse and to maintain the integrity of forms and requests.',
        'Preferences — to remember basic choices such as interface state.',
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
    title: 'Analytics without cookies',
    blocks: [
      { type: 'p', text: 'We measure aggregate traffic with Plausible, a privacy-first analytics tool that does not use cookies, does not collect personal data and does not track you across sites. Because it is cookieless, there is no analytics cookie to opt out of.' },
    ],
  },
  {
    id: 'managing',
    title: 'Managing cookies',
    blocks: [
      { type: 'p', text: 'You can control or delete cookies through your browser settings. Because the cookies we set are essential, blocking them may prevent you from signing in or completing a purchase. Since we do not use advertising or non-essential tracking cookies, there is no marketing consent to manage.' },
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
        dateModified: '2026-05-31',
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
    intro="No advertising trackers, no cross-site profiling. Just the essential cookies that keep you signed in and your payments secure — plus cookieless analytics."
    :updated="updated"
    :sections="sections"
  />
</template>
