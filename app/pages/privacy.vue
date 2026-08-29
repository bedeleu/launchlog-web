<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/privacy`
const updatedIso = '2026-08-29'
const updated = 'August 29, 2026'
const operatorBrand = config.public.operatorBrand.trim()
const legalName = config.public.legalName.trim()
const legalAddress = config.public.legalAddress.trim()
const legalRegistrationId = config.public.legalRegistrationId.trim()
const legalTaxId = String(config.public.legalTaxId ?? '').trim()
const legalEmail = config.public.legalEmail.trim()
const description
  = 'How LaunchLog processes personal data for listings, accounts, payments, support, analytics and service operation, and the rights you have over it.'

const controllerFacts = [
  legalName ? `Legal name: ${legalName}.` : null,
  legalAddress ? `Registered address: ${legalAddress}.` : null,
  legalRegistrationId ? `Registration number: ${legalRegistrationId}.` : null,
  legalTaxId ? `Tax identification number: ${legalTaxId}.` : null,
  legalEmail ? `Privacy contact: ${legalEmail}.` : null,
].filter((fact): fact is string => fact !== null)

const sections = [
  {
    id: 'overview',
    title: 'Who controls your data',
    blocks: [
      { type: 'p', text: `${operatorBrand || 'AB Solutions'} operates the LaunchLog service at launchlog.ai. The contracting service provider is the legal entity identified below and is the controller for the processing described in this policy.` },
      ...(controllerFacts.length ? [{ type: 'list', items: controllerFacts }] : []),
      { type: 'p', text: 'We collect only what is needed to provide and secure the directory. We do not sell or share personal data for cross-context behavioural advertising, rent contact lists, or build advertising profiles.' },
    ],
  },
  {
    id: 'data-we-process',
    title: 'Personal data and sources',
    blocks: [
      { type: 'subhead', text: 'Data you provide' },
      { type: 'list', items: [
        'Account data: email address, Firebase authentication identifier and account status when you sign in.',
        'Preview and listing data: submitted URL, product content, category, contact email, edits and moderation history.',
        'Billing data: customer and subscription references, plan, payment status, invoice and receipt facts. Card details are entered directly with Stripe and do not reach LaunchLog servers.',
        'Contract evidence: the accepted Terms version, express immediate-performance request, notice version, language, server receipt time and checkout/contract references used to prove what was agreed. We do not rely on a browser-authored acceptance timestamp.',
        'Withdrawal records: your name, the contract-identification details you provide, confirmation email, language, declaration text, server receipt time/reference and confirmation-delivery status. You do not have to provide a reason.',
        'Support and legal correspondence: your name, email, website and message when you contact us.',
      ] },
      { type: 'subhead', text: 'Data generated or obtained during service use' },
      { type: 'list', items: [
        'Public website evidence: title, description, OpenGraph data, favicon, screenshot and related public metadata fetched from the URL you submit or from public sources used to maintain directory entries.',
        'Security and operations data: request time, route, response status, IP address and user-agent where infrastructure providers need them for delivery, rate limiting, abuse prevention, diagnostics and security.',
        'Optional aggregate analytics: after your explicit analytics choice, LaunchLog can send a controlled direct request to the self-hosted Plausible Events API. The request body is limited to the site domain, an approved event name and a sanitised public URL. Plausible transiently processes the IP address and user-agent to derive a rotating daily pseudonymous visitor identifier and aggregate browser, operating-system, device and country/region/city dimensions. Raw IP addresses and full user-agent strings are not retained in the Plausible event database.',
        'Campaign context: Plausible may receive only the complete allowlisted Reddit test tuple across utm_source, utm_medium, utm_campaign, utm_content and utm_term on approved public routes. Partial, arbitrary or identifier-shaped UTM values, private preview URLs, tokens, Stripe Session IDs and Reddit click IDs are blocked. An inbound rdt_cid is removed from the browser URL and is not intentionally stored or sent to Plausible.',
      ] },
    ],
  },
  {
    id: 'purposes-bases',
    title: 'Purposes and legal bases',
    blocks: [
      { type: 'p', text: 'Where the GDPR or UK GDPR applies, we use the following legal bases:' },
      { type: 'list', items: [
        'Contract and steps at your request — to create a preview, open an account, process checkout, publish and maintain a paid listing, provide billing access and respond to service requests.',
        'Legitimate interests — to secure the service, prevent fraud and spam, diagnose failures, protect legal claims, keep public directory information accurate and perform proportionate human moderation. We balance these interests against your rights.',
        'Legal obligation — to retain and disclose transaction, accounting, tax or compliance records where applicable law requires it.',
        'Contract, legal obligation and legal claims — to record contract acceptance and immediate-performance instructions, receive and confirm withdrawal declarations, apply consumer remedies, prevent duplicate processing and establish, exercise or defend legal claims.',
        'Consent — to send optional aggregate analytics to the self-hosted Plausible Events API. Refusing or withdrawing analytics consent does not affect access to LaunchLog.',
      ] },
      { type: 'p', text: 'We do not make decisions producing legal or similarly significant effects solely by automated means. Optional AI-assisted copy remains a draft until an authorised human applies it.' },
    ],
  },
  {
    id: 'analytics-control',
    title: 'Analytics and advertising controls',
    blocks: [
      { type: 'p', text: 'No Plausible vendor script or vendor-provided automatic analytics listener runs in the browser. After a valid explicit analytics choice, LaunchLog’s controlled browser sender can make direct Events API requests only for approved public pageviews and three connected funnel events: Preview Created, Checkout Started and Payment Canceled. Listing Published remains an approved goal name, but no publication event is sent until a separately reviewed server-side consent and retention contract is activated. Each browser payload is filtered before it is sent and carries no referrer, cookie credentials or custom properties.' },
      { type: 'p', text: 'You can withdraw consent at any time through “Privacy choices” in the footer. Withdrawal stops future analytics requests but does not automatically delete aggregate events recorded before withdrawal; processing completed before withdrawal remains subject to the configured analytics retention and your applicable data-protection rights.' },
      { type: 'p', text: 'No Reddit Pixel, advertising cookie or Reddit Conversions API integration is active. A future advertising-measurement capability would require a new documented purpose, data map, consent decision where applicable, policy update and separate technical activation.' },
    ],
  },
  {
    id: 'recipients',
    title: 'Recipients and processors',
    blocks: [
      { type: 'p', text: 'We disclose data only as needed to operate LaunchLog, follow your instructions, protect the service or comply with law. Current service providers and infrastructure include:' },
      { type: 'list', items: [
        'Firebase Authentication (Google) — authentication and identity.',
        'Stripe — payment processor for hosted checkout, subscription billing, fraud prevention, invoices and the billing portal.',
        'Railway — application, PostgreSQL and Redis hosting.',
        'Cloudflare — DNS, proxy, security and R2 asset storage.',
        'Microlink — screenshot and public website metadata capture.',
        'Google Gemini — optional server-side copy proposals based on submitted and public website evidence.',
        'Resend — transactional email delivery.',
        'Sentry — scrubbed application error monitoring.',
        'Plausible — self-hosted Events API endpoint for consent-gated aggregate analytics.',
        'Better Stack — availability monitoring of public health endpoints.',
      ] },
      { type: 'p', text: 'We may disclose information to professional advisers, competent authorities or other parties where legally required or necessary to establish, exercise or defend legal claims.' },
    ],
  },
  {
    id: 'retention',
    title: 'Retention',
    blocks: [
      { type: 'list', items: [
        'Free previews stop being available through the active-preview endpoint after 7 days. Browser-side preview drafts are pruned after their recorded expiry, or after at most 7 days where no earlier expiry is available, when the app next loads; clearing site data removes them sooner.',
        'Published listing and account records remain while the service or subscription is active, then only as long as needed for account closure, disputes, abuse prevention and applicable limitation periods.',
        'Payment, invoice and accounting records are retained for the period required by applicable Romanian tax and accounting law.',
        'Checkout-agreement evidence is retained for the contract lifecycle and then only through the applicable mandatory accounting/tax archival or legal-claims period. Withdrawal declarations and receipts are retained until the request and any refund/dispute are resolved and then through the applicable limitation period. After the controlling period ends, records are deleted or irreversibly minimised unless a documented legal hold applies.',
        'Application, infrastructure, security and provider logs are kept only for the shortest configured period needed to deliver and secure the service, investigate incidents and meet applicable legal obligations, then deleted or irreversibly minimised. A documented legal hold may extend a relevant record where necessary.',
        'Previously recorded Plausible aggregate events remain for the configured analytics retention period or until they are deleted through an applicable operational or data-rights process. Withdrawing consent stops future collection but does not automatically delete those historical aggregate events.',
        'The local analytics-choice record is treated as expired after six months. It is removed on the next relevant app load, focus or storage read, and sooner if you clear site data or a later policy version replaces it. It is not sent to Plausible.',
      ] },
      { type: 'p', text: 'Public listing content may remain temporarily in third-party search, CDN or AI caches after removal; those independent copies are outside our direct control, but we will take reasonable steps where a valid request applies.' },
    ],
  },
  {
    id: 'rights',
    title: 'Your data-protection rights',
    blocks: [
      { type: 'p', text: 'Depending on the law that applies, you may request access, rectification, erasure, restriction, portability, or object to processing based on legitimate interests. You may withdraw consent at any time without affecting processing that was lawful before withdrawal.' },
      { type: 'p', text: legalEmail ? `Send a request to ${legalEmail}. We may ask for proportionate information to verify identity and normally respond within one month under the GDPR; a permitted extension will be explained.` : 'Use the Legal & privacy channel on the Contact page. We may ask for proportionate information to verify identity and normally respond within one month under the GDPR; a permitted extension will be explained.' },
      { type: 'p', text: 'You may complain to your local supervisory authority. In Romania, the authority is ANSPDCP (Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal) at dataprotection.ro.' },
    ],
  },
  {
    id: 'transfers-security',
    title: 'International transfers and security',
    blocks: [
      { type: 'p', text: 'Some providers may process data outside the EEA or United Kingdom. Where required, transfers rely on an adequacy decision, Standard Contractual Clauses or another lawful transfer mechanism available in the relevant provider agreement.' },
      { type: 'p', text: 'We use encryption in transit, access controls, secret separation, signed payment webhooks, scoped authentication and data scrubbing. No service can guarantee absolute security. If a personal-data breach creates a reportable risk, we follow applicable notification duties.' },
    ],
  },
  {
    id: 'children-changes',
    title: 'Children and policy changes',
    blocks: [
      { type: 'p', text: 'Paid LaunchLog services are not directed to children. You must be able to form a binding contract in your jurisdiction. Contact us if you believe a child has provided personal data improperly.' },
      { type: 'p', text: 'We update this notice when processing materially changes. The date above identifies the current version; where required, we will request a new choice rather than treating silence as consent.' },
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
  link: [
    { rel: 'canonical', href: pageUrl },
    { rel: 'alternate', hreflang: 'en-US', href: pageUrl },
    { rel: 'alternate', hreflang: 'ro-RO', href: `${siteUrl}/ro/privacy` },
    { rel: 'alternate', hreflang: 'x-default', href: pageUrl },
  ],
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
    title="Privacy Policy"
    intro="A precise account of what LaunchLog processes, why, who receives it, how long it is kept, and the control you have over optional analytics."
    :updated="updated"
    :sections="sections"
    :contact-email="legalEmail"
    alternate-path="/ro/privacy"
    alternate-label="Versiunea în română"
  />
</template>
