<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/cookies`
const updatedIso = '2026-08-29'
const updated = 'August 29, 2026'
const legalEmail = config.public.legalEmail.trim()
const description
  = 'The exact browser storage used by LaunchLog, the optional Plausible analytics choice, Stripe cookies and how to change your preferences.'

const sections = [
  {
    id: 'summary',
    title: 'Storage at a glance',
    blocks: [
      { type: 'p', text: 'LaunchLog uses browser storage needed for features you request and one optional analytics purpose. Essential storage remains available because sign-in, preview recovery, checkout return handling and remembering your privacy choice would not work reliably without it.' },
      { type: 'p', text: 'Optional self-hosted Plausible analytics is off by default. After you accept analytics, LaunchLog may send a controlled direct request to the self-hosted Plausible Events API. No Reddit Pixel, advertising cookie or native advertising conversion integration is active.' },
    ],
  },
  {
    id: 'first-party-storage',
    title: 'LaunchLog first-party storage',
    blocks: [
      { type: 'p', text: 'The current application uses these named browser records:' },
      { type: 'list', items: [
        'launchlog:privacy-consent:v1 — localStorage record containing the policy version, analytics choice and decision time. Purpose: remember and apply your current choice. It is treated as expired after six months and removed on the next relevant app load, focus or storage read; clearing site data or a later policy version removes or supersedes it sooner.',
        'launchlog:magic-link-email and launchlog:magic-link-email-expires-at — localStorage records containing the email entered for email-link sign-in and its expiry. Purpose: complete sign-in on the same device. They are no longer accepted after one hour and are removed on the next app read/load; they are also removed immediately after any successful sign-in, a failed stored-email retry, sign-out, replacement or clearing site data.',
        'launchlog:intake:last-url and launchlog:intake:last-url-expires-at — localStorage records used to resume the last URL submitted for a preview. They are no longer accepted after seven days, or when the related preview expires sooner, and are removed on the next app load/resolution; invalidity, replacement or clearing site data removes them sooner.',
        'launchlog:intake:latest-token — localStorage record identifying the most recent private preview on that browser. It remains until another preview replaces it, until the recorded preview expiry is pruned when the application loads, or until you clear site data.',
        'launchlog:intake:drafts — localStorage preview drafts that may include the private token, source URL, listing fields, contact email, selected tier and expiry time. A draft is no longer accepted after the recorded preview expiry or seven days from its last update, whichever is earlier, and is pruned on the next app load or recovery attempt.',
        'launchlog:intake:url-index — localStorage index from a normalised submitted URL to its private preview token. An entry remains only while its linked draft remains, or until you clear site data.',
        'launchlog:intake:preferred-tier — one-use localStorage value carrying a pricing choice into the preview flow. It remains until it is applied to a preview, replaced by another choice, or cleared.',
        'launchlog:checkout-return:<preview-token> — sessionStorage marker used to reconcile a return from Stripe. It is removed after reconciliation and otherwise ends with the browser session.',
      ] },
      { type: 'p', text: 'Preview pruning runs when the application loads and when a saved URL is resolved. It removes drafts with a past or invalid recorded expiry, their URL-index entries and an expired latest-token reference. You can remove every LaunchLog record sooner by clearing site data in your browser.' },
    ],
  },
  {
    id: 'firebase',
    title: 'Authentication storage',
    blocks: [
      { type: 'p', text: 'Firebase Authentication may use first-party IndexedDB, localStorage or similar browser persistence to restore an authenticated session and protect account access. This is used only for the sign-in service you request. Clearing it signs you out.' },
    ],
  },
  {
    id: 'analytics',
    title: 'Optional analytics',
    blocks: [
      { type: 'p', text: 'No Plausible vendor script, vendor-provided automatic listener, analytics cookie or persistent analytics identifier is installed. After consent, LaunchLog’s own controlled sender can make a direct request to the self-hosted Plausible Events API. The request body contains only the site domain, an approved event name and a sanitised public URL; it is sent without cookie credentials or a referrer.' },
      { type: 'p', text: 'The connected browser events are a pageview on an allowed public route and three funnel events: Preview Created, Checkout Started and Payment Canceled. Listing Published remains a reserved approved goal name, but no publication event is sent until a separately reviewed server-side consent and retention contract is activated. Public pageviews may retain one bounded value for each approved UTM field. Funnel events use the query-free /submit URL. The filter rejects private previews, checkout URLs, account routes, tokens, Stripe Session IDs, rdt_cid values, arbitrary query parameters and custom properties.' },
    ],
  },
  {
    id: 'stripe',
    title: 'Stripe checkout and billing',
    blocks: [
      { type: 'p', text: 'When you choose checkout or open the billing portal, you leave LaunchLog for a Stripe-hosted page. Stripe may set cookies or use similar storage required for payment security, fraud prevention, session continuity and regulatory compliance. Stripe controls those records under its own privacy and cookie notices.' },
    ],
  },
  {
    id: 'choices',
    title: 'Manage or withdraw your choice',
    blocks: [
      { type: 'p', text: 'Open “Privacy choices” in the footer at any time. Accept and reject are available with equal prominence on the first layer. Optional analytics starts only after acceptance; rejecting or withdrawing stops future analytics requests without affecting core features. Withdrawal does not automatically erase aggregate events already recorded; those historical events remain subject to the retention and rights described in the Privacy Policy.' },
      { type: 'p', text: 'Browser settings can also block or delete storage. Blocking essential storage may sign you out, prevent email-link completion, remove preview recovery state or interfere with Stripe checkout.' },
    ],
  },
  {
    id: 'changes',
    title: 'New technologies and changes',
    blocks: [
      { type: 'p', text: 'A new advertising tracker or materially different analytics purpose will require an updated audit, disclosure and consent version where applicable. We will not treat continued browsing, inactivity or a pre-selected control as consent.' },
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
  link: [
    { rel: 'canonical', href: pageUrl },
    { rel: 'alternate', hreflang: 'en-US', href: pageUrl },
    { rel: 'alternate', hreflang: 'ro-RO', href: `${siteUrl}/ro/cookies` },
    { rel: 'alternate', hreflang: 'x-default', href: pageUrl },
  ],
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
    title="Cookie & Browser Storage Policy"
    intro="The exact first-party records LaunchLog uses, what is essential, what is optional, and how to change your analytics choice."
    :updated="updated"
    :sections="sections"
    :contact-email="legalEmail"
    alternate-path="/ro/cookies"
    alternate-label="Versiunea în română"
  />
</template>
