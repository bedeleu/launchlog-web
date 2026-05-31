<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/dmca`
const updated = 'May 31, 2026'
const description
  = 'LaunchLog’s copyright and DMCA policy — how to submit a takedown notice, what to include, the counter-notice process and our repeat-infringer policy.'

const sections = [
  {
    id: 'overview',
    title: 'Overview',
    blocks: [
      { type: 'p', text: 'LaunchLog respects the intellectual property of others and expects its users to do the same. If you believe content on launchlog.ai infringes your copyright, you may submit a notice and we will respond in accordance with the Digital Millennium Copyright Act (DMCA) and similar laws.' },
      { type: 'p', text: 'Because listings link to third-party websites we do not control, takedown requests directed at LaunchLog can only address content hosted on launchlog.ai itself.' },
    ],
  },
  {
    id: 'notice',
    title: 'Filing a takedown notice',
    blocks: [
      { type: 'p', text: 'To report allegedly infringing content, send a written notice to dmca@launchlog.ai that includes all of the following:' },
      { type: 'list', items: [
        'Identification of the copyrighted work you claim has been infringed.',
        'The specific URL(s) on launchlog.ai of the material you want removed, so we can locate it.',
        'Your name, address, telephone number and email address.',
        'A statement that you have a good-faith belief the use is not authorised by the copyright owner, its agent or the law.',
        'A statement, under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorised to act on its behalf.',
        'Your physical or electronic signature.',
      ] },
    ],
  },
  {
    id: 'process',
    title: 'What happens next',
    blocks: [
      { type: 'p', text: 'When we receive a complete notice, we will review it and may remove or disable access to the reported content. Where appropriate, we will notify the affected user and provide them a copy of the notice so they can respond.' },
    ],
  },
  {
    id: 'counter',
    title: 'Counter-notice',
    blocks: [
      { type: 'p', text: 'If your content was removed and you believe this was a mistake or misidentification, you may send a counter-notice to dmca@launchlog.ai including:' },
      { type: 'list', items: [
        'Identification of the removed content and the URL where it appeared.',
        'A statement, under penalty of perjury, that you have a good-faith belief the content was removed as a result of mistake or misidentification.',
        'Your name, address, telephone number and email, and your consent to the jurisdiction of the appropriate courts.',
        'Your physical or electronic signature.',
      ] },
      { type: 'p', text: 'We may restore the content if the original complainant does not pursue a court order within the period required by law.' },
    ],
  },
  {
    id: 'repeat',
    title: 'Repeat infringers and misuse',
    blocks: [
      { type: 'p', text: 'We may terminate, without notice, the accounts of users who are repeat infringers. Please note that submitting a false or bad-faith notice or counter-notice may expose you to liability for damages. If you are unsure whether material is infringing, consult a lawyer before filing.' },
    ],
  },
]

useSeoMeta({
  title: 'DMCA & Copyright — LaunchLog',
  description,
  ogTitle: 'DMCA & Copyright — LaunchLog',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'website',
  twitterTitle: 'DMCA & Copyright — LaunchLog',
  twitterDescription: description,
})

useHead({
  link: [{ rel: 'canonical', href: pageUrl }],
  script: [
    {
      key: 'launchlog-dmca-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'DMCA & Copyright — LaunchLog',
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
    title="DMCA & Copyright"
    intro="We respect intellectual property. If something on LaunchLog infringes your copyright, here is exactly how to file a takedown notice and how the counter-notice process works."
    :updated="updated"
    :sections="sections"
  />
</template>
