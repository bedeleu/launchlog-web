<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/terms`
// One source of truth for the date: the visible line and the JSON-LD dateModified drifted
// apart before, so the human-readable form is derived rather than written twice.
const updatedIso = '2026-08-16'
const updated = new Date(`${updatedIso}T00:00:00Z`).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})
const legalName = config.public.legalName.trim()
const legalEmail = config.public.legalEmail.trim()
const supportEmail = config.public.supportEmail.trim()
const description
  = 'The terms for using LaunchLog, including accounts, listings, acceptable use, annual subscriptions, manual refund requests and moderation.'

const sections = [
  {
    id: 'agreement',
    title: 'Agreement',
    blocks: [
      { type: 'p', text: 'These Terms of Service govern your access to and use of launchlog.ai and related services (the "Service"). By creating an account, submitting a listing or otherwise using the Service, you agree to these terms. If you do not agree, do not use the Service.' },
      { type: 'p', text: legalName ? `The Service is operated by ${legalName}.` : 'The legal operator name is not currently configured for display on this page.' },
      { type: 'p', text: 'If you use the Service on behalf of a company, you represent that you are authorised to bind that company to these terms.' },
    ],
  },
  {
    id: 'the-service',
    title: 'The service',
    blocks: [
      { type: 'p', text: 'LaunchLog is a curated, paid directory for indie makers, SaaS founders and tech launches. We provide listing pages, a free private preview before purchase, and discovery surfaces designed to be understood by people, search engines and AI answer engines.' },
      { type: 'p', text: 'Paid plans determine placement inside LaunchLog. Featured listings appear above Premium listings, and Premium above Basic, in browse and category results; Featured listings also appear in the homepage Featured section. Within each plan, the order is re-seeded once per calendar day (UTC); it is not a fixed rotation and we do not guarantee any exposure cadence. The homepage Featured section displays up to three Featured listings at a time, so a Featured listing is eligible for one of those slots rather than guaranteed one.' },
      { type: 'p', text: 'Your listing remains published for as long as your subscription is active. That does not mean a permanently fixed position: we do not guarantee any specific ordinal position inside LaunchLog, and we do not guarantee external search ranking, traffic, clicks, indexing speed, backlink value, sales or AI citation.' },
    ],
  },
  {
    id: 'accounts',
    title: 'Accounts',
    blocks: [
      { type: 'list', items: [
        'You are responsible for the accuracy of the information you provide and for activity under your account.',
        'You must keep your login credentials secure and notify us of any unauthorised use.',
        'You must be at least 16 years old, or the age of digital consent in your country, to use the Service.',
      ] },
    ],
  },
  {
    id: 'listings',
    title: 'Listings and content',
    blocks: [
      { type: 'p', text: 'You retain ownership of the content you submit. You grant LaunchLog a non-exclusive, worldwide licence to host, display, reproduce, adapt for formatting, and distribute that content for the purpose of operating and promoting the directory, including in machine-readable formats (structured data, llms.txt and markdown).' },
      { type: 'subhead', text: 'You agree that your listing will not:' },
      { type: 'list', items: [
        'Promote illegal products, fraud, malware, adult content, gambling, or content that infringes others’ rights.',
        'Contain false, misleading or deceptive claims about the product.',
        'Include spam, hidden text, cloaking, deceptive redirects or manipulative SEO tactics.',
        'Misrepresent ownership of, or authorisation to list, the product.',
      ] },
    ],
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    blocks: [
      { type: 'p', text: 'You agree not to abuse, disrupt or attempt to gain unauthorised access to the Service; not to scrape, overload or reverse-engineer it beyond what our documented public API permits; and not to use the Service to distribute spam or harmful content. We may apply administrator moderation actions to enforce these rules.' },
    ],
  },
  {
    id: 'payments',
    title: 'Subscriptions and payments',
    blocks: [
      { type: 'list', items: [
        'Listings are sold as annual recurring subscriptions in USD, billed through Stripe.',
        'Plans renew automatically each year unless cancelled before the renewal date.',
        'Prices may change; any change applies from your next renewal, not retroactively.',
        'You authorise us and Stripe to charge your payment method for the plan you select and its renewals.',
      ] },
    ],
  },
  {
    id: 'refunds',
    title: 'Refunds',
    blocks: [
      { type: 'p', text: supportEmail ? `We offer a 7-day money-back guarantee on the initial payment. Send a request to ${supportEmail} within 7 days of purchase. Refund requests are reviewed and processed manually in Stripe; rejecting or unpublishing a listing does not issue one. After 7 days, payments and renewals are non-refundable except where required by law. You can cancel future renewals through the billing portal.` : 'We offer a 7-day money-back guarantee on the initial payment. Refund requests are reviewed and processed manually in Stripe; rejecting or unpublishing a listing does not issue one. A public request mailbox is not currently configured, so check the Contact page for the current channel. After 7 days, payments and renewals are non-refundable except where required by law. You can cancel future renewals through the billing portal.' },
    ],
  },
  {
    id: 'moderation',
    title: 'Moderation and removal',
    blocks: [
      { type: 'p', text: 'A successful paid conversion publishes the listing. An administrator may later edit, unpublish to pending-review status, republish or reject a listing that violates these terms or reasonably harms users or the directory. Moderation actions do not automatically refund a payment or respond to a Stripe dispute.' },
    ],
  },
  {
    id: 'ip-thirdparty',
    title: 'Intellectual property and third parties',
    blocks: [
      { type: 'p', text: 'The LaunchLog name, brand, design and software are protected by applicable law. Listings link to third-party websites we do not control; we are not responsible for their content, products or practices.' },
    ],
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers and liability',
    blocks: [
      { type: 'p', text: 'The Service is provided "as is" and "as available" without warranties of any kind, to the maximum extent permitted by law. We do not warrant uninterrupted or error-free operation, or any particular discovery, ranking or business outcome.' },
      { type: 'p', text: 'To the maximum extent permitted by law, the Service operator’s total liability arising out of or relating to the Service is limited to the amount you paid for the Service in the 12 months preceding the claim. The operator is not liable for indirect, incidental or consequential damages. You agree to indemnify the operator against claims arising from your content or your breach of these terms.' },
    ],
  },
  {
    id: 'termination-law',
    title: 'Termination, law and changes',
    blocks: [
      { type: 'p', text: 'You may stop using the Service and cancel at any time. We may suspend or terminate access for violations of these terms. Governing law and forum follow the Service operator’s place of establishment and any mandatory consumer protections that apply. We may update these terms; continued use after changes take effect constitutes acceptance, and the "Last updated" date above reflects the current version.' },
    ],
  },
]

useSeoMeta({
  title: 'Terms of Service — LaunchLog',
  description,
  ogTitle: 'Terms of Service — LaunchLog',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'website',
  twitterTitle: 'Terms of Service — LaunchLog',
  twitterDescription: description,
})

useHead({
  link: [{ rel: 'canonical', href: pageUrl }],
  script: [
    {
      key: 'launchlog-terms-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'Terms of Service — LaunchLog',
        description,
        inLanguage: 'en-US',
        dateModified: updatedIso,
        isPartOf: { '@id': `${siteUrl}/#website` },
      }),
    },
  ],
})
</script>

<template>
  <LegalDoc
    eyebrow="Legal"
    title="Terms of Service"
    intro="The rules for using LaunchLog — what we provide, what we expect from listings, how subscriptions and refunds work, and the limits of our liability."
    :updated="updated"
    :sections="sections"
    :contact-email="legalEmail"
  />
</template>
