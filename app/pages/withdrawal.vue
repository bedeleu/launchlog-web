<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/withdrawal`
const description = 'Submit an online declaration to withdraw from an eligible LaunchLog consumer contract and receive a dated confirmation.'

useSeoMeta({
  title: 'Withdraw from a contract — LaunchLog',
  description,
  ogTitle: 'Withdraw from a contract — LaunchLog',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'website',
  robots: 'noindex, nofollow',
})

useHead({
  link: [
    { rel: 'canonical', href: pageUrl },
    { rel: 'alternate', hreflang: 'en-US', href: pageUrl },
    { rel: 'alternate', hreflang: 'ro-RO', href: `${siteUrl}/ro/retragere` },
    { rel: 'alternate', hreflang: 'x-default', href: pageUrl },
  ],
})
</script>

<template>
  <ContentReadingShell
    wide
    label="Consumer contract · Permanent function"
    title="Withdraw from a contract."
    intro="Use this function to send an unambiguous withdrawal declaration for an eligible consumer contract. You do not need to provide a reason."
  >
    <template #meta>
      <ContentReadingMeta
        :items="[
          { label: 'Contracting provider', value: config.public.legalName || 'Not configured' },
          { label: 'Confirmation', value: 'Dated receipt by email' },
          { label: 'Language', value: 'English' },
        ]"
      />
    </template>

    <div class="mb-10 flex flex-wrap items-center gap-4 border-b border-release-seam pb-6">
      <NuxtLink to="/ro/retragere" class="release-action-secondary">Română</NuxtLink>
      <p class="text-sm leading-6 text-release-paper-muted">
        Cancelling renewal in the billing portal is separate from exercising a statutory withdrawal right.
      </p>
    </div>

    <LegalWithdrawalForm
      locale="en"
      :legal-name="config.public.legalName"
      :legal-address="config.public.legalAddress"
      :legal-email="config.public.legalEmail"
      :legal-registration-id="config.public.legalRegistrationId"
      :legal-tax-id="config.public.legalTaxId"
    />
  </ContentReadingShell>
</template>
