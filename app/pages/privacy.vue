<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/privacy`
const updated = 'May 31, 2026'
const description
  = 'How LaunchLog collects, uses, shares and protects personal data — the information we process for listings, accounts, payments and analytics, and the rights you have over it.'

const sections = [
  {
    id: 'overview',
    title: 'Overview',
    blocks: [
      { type: 'p', text: 'LaunchLog ("LaunchLog", "we", "us") operates launchlog.ai, a curated directory for indie makers, SaaS founders and tech launches. This policy explains what personal data we process, why, on what legal basis, and the choices you have.' },
      { type: 'p', text: 'We keep data collection deliberately narrow. We are a directory, not an advertising network — we do not buy, sell or rent personal data, and we do not build advertising profiles.' },
    ],
  },
  {
    id: 'data-we-collect',
    title: 'Information we collect',
    blocks: [
      { type: 'subhead', text: 'Information you provide' },
      { type: 'list', items: [
        'Account data: email address and authentication identifier when you sign in (handled by Firebase Authentication).',
        'Listing data: the product URL, name, tagline, description, category and contact email you submit or edit for a listing or free preview.',
        'Billing data: name and billing details required to process a subscription. Card numbers are entered directly with Stripe and never reach our servers.',
        'Correspondence: messages you send to our support, legal or DMCA addresses.',
      ] },
      { type: 'subhead', text: 'Information collected automatically' },
      { type: 'list', items: [
        'Public metadata fetched from the URL you submit (title, meta description, OpenGraph data, favicon, screenshot) to build your listing preview.',
        'Aggregate, privacy-first analytics about page visits via Plausible. Plausible does not use cookies and does not collect personal data.',
        'Server and security logs (IP address, user agent, timestamps) retained briefly for abuse prevention and reliability.',
      ] },
    ],
  },
  {
    id: 'how-we-use',
    title: 'How we use information',
    blocks: [
      { type: 'list', items: [
        'To create, enrich, publish and moderate listings and previews.',
        'To authenticate you and protect your account.',
        'To process subscriptions, issue receipts and handle refunds under our 7-day guarantee.',
        'To respond to support, legal and takedown requests.',
        'To keep the service secure, prevent spam and abuse, and improve the product.',
        'To send essential transactional email (e.g. receipts, security and listing status). Marketing email, if any, is opt-in.',
      ] },
    ],
  },
  {
    id: 'legal-bases',
    title: 'Legal bases (GDPR)',
    blocks: [
      { type: 'p', text: 'Where the GDPR applies, we rely on the following legal bases:' },
      { type: 'list', items: [
        'Contract — to provide listings, accounts and paid subscriptions you request.',
        'Legitimate interests — to secure the service, prevent abuse and maintain a useful, spam-free directory, balanced against your rights.',
        'Legal obligation — to keep transaction and tax records.',
        'Consent — where required, for any optional communications, which you can withdraw at any time.',
      ] },
    ],
  },
  {
    id: 'processors',
    title: 'Sharing and processors',
    blocks: [
      { type: 'p', text: 'We share data only with vetted service providers who process it on our behalf under data-processing terms. We do not sell personal data. Current processors include:' },
      { type: 'list', items: [
        'Stripe — payments and subscription billing.',
        'Firebase Authentication (Google) — sign-in and identity.',
        'Railway — application hosting and the PostgreSQL database.',
        'Cloudflare — DNS, CDN, asset storage (R2) and security.',
        'Microlink — website screenshot and metadata capture for previews.',
        'Plausible — cookieless, aggregate analytics.',
        'Resend — transactional email delivery.',
      ] },
      { type: 'p', text: 'We may also disclose information where required by law or to protect our rights, our users and the safety of the service.' },
    ],
  },
  {
    id: 'retention',
    title: 'Data retention',
    blocks: [
      { type: 'list', items: [
        'Free previews are private, excluded from search, and expire automatically after 7 days.',
        'Published listing content remains while your listing is active and may persist in caches and AI/search indexes outside our control after removal.',
        'Account and billing records are kept for the life of the account and for the period required by tax and accounting law thereafter.',
        'Security logs are retained for a short period for abuse prevention, then deleted or anonymised.',
      ] },
    ],
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    blocks: [
      { type: 'p', text: 'Depending on your location, you may have the right to access, correct, delete, export or restrict processing of your personal data, and to object to certain processing. To exercise any right, email privacy@launchlog.ai. We will respond within the timeframe required by applicable law. You may also lodge a complaint with your local data protection authority.' },
    ],
  },
  {
    id: 'transfers-security',
    title: 'Transfers and security',
    blocks: [
      { type: 'p', text: 'Our providers may process data in the United States and the European Union. Where data leaves the EEA, transfers are covered by appropriate safeguards such as Standard Contractual Clauses.' },
      { type: 'p', text: 'We protect data with encryption in transit, scoped access, and reputable infrastructure providers. No method of transmission or storage is perfectly secure, but we work to protect your information and limit what we collect.' },
    ],
  },
  {
    id: 'children-changes',
    title: 'Children and changes',
    blocks: [
      { type: 'p', text: 'LaunchLog is not directed to children under 16 and we do not knowingly collect their data. If you believe a child has provided us data, contact us and we will remove it.' },
      { type: 'p', text: 'We may update this policy as the product evolves. Material changes will be reflected by the "Last updated" date above, and significant changes will be communicated where appropriate.' },
    ],
  },
]

useSeoMeta({
  title: 'Privacy Policy — LaunchLog',
  description,
  ogTitle: 'Privacy Policy — LaunchLog',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'website',
  twitterTitle: 'Privacy Policy — LaunchLog',
  twitterDescription: description,
})

useHead({
  link: [{ rel: 'canonical', href: pageUrl }],
  script: [
    {
      key: 'launchlog-privacy-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'Privacy Policy — LaunchLog',
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
    title="Privacy Policy"
    intro="We collect as little as possible and never sell your data. Here is exactly what LaunchLog processes, why, and the control you have over it."
    :updated="updated"
    :sections="sections"
  />
</template>
