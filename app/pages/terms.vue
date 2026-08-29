<script setup lang="ts">
import { CHECKOUT_TERMS_VERSION } from '#shared/constants/checkout-legal'

const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/terms`
const updatedIso = CHECKOUT_TERMS_VERSION
const updated = new Date(`${updatedIso}T00:00:00Z`).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})
const operatorBrand = config.public.operatorBrand.trim() || 'AB Solutions'
const legalName = config.public.legalName.trim()
const legalAddress = config.public.legalAddress.trim()
const legalRegistrationId = config.public.legalRegistrationId.trim()
const legalTaxId = String(config.public.legalTaxId ?? '').trim()
const legalShareCapital = config.public.legalShareCapital.trim()
const legalPhone = config.public.legalPhone.trim()
const legalEmail = config.public.legalEmail.trim()
const supportEmail = config.public.supportEmail.trim()
const taxNotice = config.public.taxNoticeEn.trim()
const description
  = 'Terms for LaunchLog accounts, listings, annual subscriptions, consumer rights, moderation, cancellation and Romanian governing law.'

const providerDetails = [
  legalAddress ? `Registered address: ${legalAddress}.` : null,
  legalRegistrationId ? `Registration number: ${legalRegistrationId}.` : null,
  legalTaxId ? `Tax identification number: ${legalTaxId}.` : null,
  legalShareCapital ? `Share capital: ${legalShareCapital}.` : null,
  legalPhone ? `Telephone: ${legalPhone}.` : null,
  legalEmail ? `Email: ${legalEmail}.` : null,
].filter((detail): detail is string => detail !== null)

const refundContact = supportEmail || legalEmail || 'the Billing channel on our Contact page'

const sections = [
  {
    id: 'agreement-provider',
    title: 'Agreement and service provider',
    blocks: [
      { type: 'p', text: 'These Terms govern access to launchlog.ai and related LaunchLog services. When you request a preview, the preview-use terms and content licence apply as disclosed beside the submit action. A paid contract is formed only through explicit checkout acceptance. If you act for an organisation, you confirm you have authority to bind it.' },
      { type: 'p', text: `${operatorBrand} is the public operating brand. ${legalName ? `The contracting service provider is ${legalName}.` : 'The formal contracting service provider must be identified in the configured legal notice before paid production use.'}` },
      ...(providerDetails.length ? [{ type: 'list', items: providerDetails }] : []),
    ],
  },
  {
    id: 'eligibility',
    title: 'Eligibility and accounts',
    blocks: [
      { type: 'list', items: [
        'You must be at least 18, or the legal age to form a binding contract where you live.',
        'You must provide accurate information, keep account access secure and promptly report unauthorised use.',
        'The Service is designed primarily for founders, professionals and businesses. Mandatory consumer rights still apply whenever you legally qualify as a consumer.',
      ] },
    ],
  },
  {
    id: 'service-placement',
    title: 'Service and placement',
    blocks: [
      { type: 'p', text: 'LaunchLog is a curated directory offering a free private preview before purchase and paid annual listing subscriptions. Submitted public website evidence may be used to create a preview; optional AI-assisted copy is a proposal and is not published without an authorised human action.' },
      { type: 'p', text: 'Featured listings appear before Standard listings within a directory page, subject to a maximum of three Featured slots per page. Overflow Featured listings continue on following pages. Within a plan, ordering is re-seeded once per UTC calendar day. The homepage displays up to three Featured listings at a time.' },
      { type: 'p', text: 'A subscription provides eligibility for the selected LaunchLog placement while active. It does not guarantee a fixed position, impression count, traffic, clicks, indexing, backlink value, sales, search ranking or AI citation.' },
    ],
  },
  {
    id: 'content',
    title: 'Your listing content',
    blocks: [
      { type: 'p', text: 'You retain ownership of content you submit. You grant the service provider a non-exclusive, worldwide licence to host, reproduce, format, display and distribute it only as needed to operate and promote the directory, including structured data, llms.txt and markdown representations.' },
      { type: 'p', text: 'You confirm that you control the submitted content or have permission to use it, and that it is accurate and lawful. You must not submit fraud, malware, illegal products, adult content, gambling, infringement, deceptive claims, hidden text, cloaking, spam or manipulative redirects.' },
    ],
  },
  {
    id: 'subscriptions',
    title: 'Price, subscription and cancellation',
    blocks: [
      { type: 'list', items: [
        'Plans are annual recurring subscriptions charged in USD through Stripe. The price, billing interval and applicable tax information are shown before you enter Stripe checkout.',
        'A subscription renews annually until cancelled. You can cancel future renewal through the authenticated billing portal; cancellation does not normally refund a completed billing period.',
        'A price change applies no earlier than the next renewal and will be communicated where applicable law requires notice.',
        'A listing remains published only while the subscription and listing status remain eligible under these Terms.',
      ] },
      ...(taxNotice ? [{ type: 'p', text: taxNotice }] : []),
    ],
  },
  {
    id: 'consumer-withdrawal',
    title: 'Refunds and consumer withdrawal',
    blocks: [
      { type: 'p', text: `Our voluntary 7-day money-back guarantee is additional to, and does not restrict, any mandatory statutory remedy. Request it from ${refundContact} within 7 days of the initial payment. We return the identifiable initial subscription payment to its original payment method unless it has already been refunded or is subject to a payment dispute.` },
      { type: 'p', text: 'If you enter the contract as an EU/EEA consumer, you generally have a 14-day statutory right of withdrawal for a distance service contract. If you ask us to begin during that period, we will request your express request for immediate performance and the acknowledgement required by law. If you withdraw after requested performance has begun but before full performance, mandatory law may require a proportionate payment for the service supplied. You lose the withdrawal right only where the legal conditions for full performance and prior acknowledgement are satisfied; otherwise mandatory rights remain intact.' },
      { type: 'link', href: '/withdrawal', text: 'Withdraw from contract here — submit an online withdrawal declaration and receive a dated confirmation by email. Cancellation of future renewal through the billing portal is a separate action.' },
      { type: 'p', text: 'Rejecting, unpublishing or cancelling a listing does not itself issue a refund. After the applicable voluntary or statutory period, charges are non-refundable except where mandatory law, a proven service failure or an approved remedy requires otherwise.' },
    ],
  },
  {
    id: 'moderation-notices',
    title: 'Moderation and illegal-content notices',
    blocks: [
      { type: 'p', text: 'We may edit, restrict, unpublish or reject content that breaches these Terms, infringes rights, creates security risk or is unlawful. Where applicable law requires it, we provide the affected user with a reason and an available review route.' },
      { type: 'p', text: 'Report allegedly illegal or infringing content through the Legal & privacy or Copyright channel on the Contact page. Include the exact listing URL, the legal basis, supporting facts, your contact details and a good-faith statement. We may request clarification and will not remove lawful content solely because a notice was submitted.' },
    ],
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    blocks: [
      { type: 'p', text: 'Do not disrupt, probe or gain unauthorised access to the Service; bypass rate limits; misuse private preview links; scrape beyond documented public interfaces; introduce malicious code; impersonate another party; or use LaunchLog to distribute spam or unlawful material.' },
    ],
  },
  {
    id: 'third-parties',
    title: 'Third-party services and intellectual property',
    blocks: [
      { type: 'p', text: 'Stripe, listed products and other linked services are operated by third parties under their own terms. LaunchLog does not control or endorse every claim on an external site. The LaunchLog name, design and software are protected by applicable intellectual-property law.' },
    ],
  },
  {
    id: 'warranties-liability',
    title: 'Conformity, warranties and liability',
    blocks: [
      { type: 'p', text: 'Consumers retain their legal conformity rights for digital services and any mandatory rights to repair, restoration of conformity, price reduction, termination or damages. Nothing in these Terms shortens or excludes those rights.' },
      { type: 'p', text: 'For business users, and only to the maximum extent permitted by law, the Service is provided “as is” and “as available”; we do not promise uninterrupted operation or a particular commercial, discovery or ranking outcome. Aggregate liability is limited to the amount paid for the Service during the 12 months before the claim, and indirect or consequential loss is excluded.' },
      { type: 'p', text: 'For consumers, liability and remedies are governed by mandatory law. No limitation in these Terms applies to fraud, wilful misconduct, death or personal injury caused by negligence, or another liability that cannot lawfully be limited.' },
    ],
  },
  {
    id: 'termination-law',
    title: 'Termination, Romanian law and changes',
    blocks: [
      { type: 'p', text: 'You may stop using the Service and cancel future renewal. We may suspend or terminate access for a material breach, security threat or legal requirement, using proportionate notice where practical.' },
      { type: 'p', text: 'These Terms are governed by Romanian law. Subject to mandatory consumer protections, including any right to bring a claim in your home jurisdiction, disputes fall within the jurisdiction of the competent courts of Timișoara, Romania.' },
      { type: 'p', text: 'We may update these Terms prospectively. Material changes affecting an active paid subscription will be communicated where required; an update does not remove rights already accrued under mandatory law.' },
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
  link: [
    { rel: 'canonical', href: pageUrl },
    { rel: 'alternate', hreflang: 'en-US', href: pageUrl },
    { rel: 'alternate', hreflang: 'ro-RO', href: `${siteUrl}/ro/terms` },
    { rel: 'alternate', hreflang: 'x-default', href: pageUrl },
  ],
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
    intro="The contract for LaunchLog previews, paid directory placements, subscriptions, content moderation, cancellation and mandatory consumer rights."
    :updated="updated"
    :sections="sections"
    :contact-email="legalEmail"
    alternate-path="/ro/terms"
    alternate-label="Versiunea în română"
  />
</template>
