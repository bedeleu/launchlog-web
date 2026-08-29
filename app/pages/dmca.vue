<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/dmca`
const updatedIso = '2026-08-29'
const updated = 'August 29, 2026'
const operatorBrand = config.public.operatorBrand.trim() || 'AB Solutions'
const legalName = config.public.legalName.trim()
const legalEmail = config.public.legalEmail.trim()
const reportEmail = config.public.dmcaEmail.trim() || legalEmail
const description
  = 'How to report copyright infringement or other allegedly illegal content on LaunchLog, how notices are reviewed and how affected users can respond.'

const sections = [
  {
    id: 'scope',
    title: 'Scope and contact point',
    blocks: [
      { type: 'p', text: `${operatorBrand} provides this notice route for reports concerning content hosted on launchlog.ai.${legalName ? ` The formal service provider is ${legalName}.` : ''}` },
      { type: 'p', text: reportEmail ? `Send copyright and illegal-content notices in Romanian or English to ${reportEmail}.` : 'The production legal and copyright mailbox must be published on the Contact page before paid production use.' },
      { type: 'p', text: 'LaunchLog can act only on material it hosts or controls. For content available solely on a linked third-party website, contact that website or the appropriate authority directly.' },
    ],
  },
  {
    id: 'notice',
    title: 'Submit a sufficiently precise notice',
    blocks: [
      { type: 'p', text: 'A notice should allow us to identify the content and understand the allegation without guessing. Include:' },
      { type: 'list', items: [
        'The exact LaunchLog listing or page URL and a clear description of the material concerned.',
        'Why you believe the content is illegal, including the applicable legal basis and relevant facts.',
        'For copyright reports, identification of the protected work and why the reported use is not authorised by the owner, an agent or the law.',
        'Your name and email address, unless applicable law permits an anonymous report.',
        'A statement confirming that you submit the notice in good faith and believe the information is accurate and complete.',
        'Supporting documents or links that can be reviewed safely, without passwords, payment-card details or private access tokens.',
      ] },
      { type: 'p', text: 'A notice that is vague, unsupported or unrelated to content hosted by LaunchLog may require clarification before a decision can be made.' },
    ],
  },
  {
    id: 'review',
    title: 'Review and decision',
    blocks: [
      { type: 'p', text: 'We review notices objectively, diligently and proportionately. A report does not trigger automatic removal. We may request clarification, preserve relevant evidence, restrict or remove content, or decide that no action is justified.' },
      { type: 'p', text: 'Where applicable law requires it, we acknowledge receipt electronically, notify the affected user and provide a clear statement of reasons for a moderation decision, including the facts relied on, the rule or legal basis and the available review route.' },
      { type: 'p', text: 'We may refer credible threats, fraud, child-safety issues or other serious illegal content to the competent authority where required or permitted by law.' },
    ],
  },
  {
    id: 'response',
    title: 'Response or review request',
    blocks: [
      { type: 'p', text: reportEmail ? `If your content was restricted or removed and you believe the decision was mistaken, reply to the decision notice or write to ${reportEmail}.` : 'If your content was restricted or removed and you believe the decision was mistaken, use the published Legal & privacy channel on the Contact page.' },
      { type: 'list', items: [
        'Identify the affected LaunchLog URL and the decision you challenge.',
        'Explain the mistake, authorisation, exception or other legal basis on which you rely.',
        'Provide accurate contact information and relevant supporting evidence.',
      ] },
      { type: 'p', text: 'We reassess the available information and restore content when restriction is no longer justified. This internal route does not limit any right to contact a court, regulator, consumer body or other competent authority.' },
    ],
  },
  {
    id: 'misuse',
    title: 'Misuse and record keeping',
    blocks: [
      { type: 'p', text: 'Knowingly false, abusive or bad-faith notices may be rejected and may expose the sender to liability under applicable law. We retain notices, evidence, decisions and correspondence only for the periods described in the Privacy Policy and as needed to handle disputes or meet legal obligations.' },
    ],
  },
]

useSeoMeta({
  title: 'Copyright & Illegal Content Notice — LaunchLog',
  description,
  ogTitle: 'Copyright & Illegal Content Notice — LaunchLog',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'website',
  twitterTitle: 'Copyright & Illegal Content Notice — LaunchLog',
  twitterDescription: description,
})

useHead({
  link: [{ rel: 'canonical', href: pageUrl }],
  script: [
    {
      key: 'launchlog-copyright-illegal-content-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'Copyright & Illegal Content Notice — LaunchLog',
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
    title="Copyright & Illegal Content Notice"
    intro="A precise route for reporting content hosted by LaunchLog, understanding how a report is reviewed and requesting reconsideration of a moderation decision."
    :updated="updated"
    :sections="sections"
    :contact-email="reportEmail"
  />
</template>
