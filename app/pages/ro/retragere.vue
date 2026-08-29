<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/ro/retragere`
const description = 'Trimiteți online o declarație de retragere dintr-un contract de consum LaunchLog eligibil și primiți o confirmare datată.'

useSeoMeta({
  title: 'Retragere din contract — LaunchLog',
  description,
  ogTitle: 'Retragere din contract — LaunchLog',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'website',
  ogLocale: 'ro_RO',
  robots: 'noindex, nofollow',
})

useHead({
  htmlAttrs: { lang: 'ro' },
  link: [
    { rel: 'canonical', href: pageUrl },
    { rel: 'alternate', hreflang: 'ro-RO', href: pageUrl },
    { rel: 'alternate', hreflang: 'en-US', href: `${siteUrl}/withdrawal` },
    { rel: 'alternate', hreflang: 'x-default', href: `${siteUrl}/withdrawal` },
  ],
})
</script>

<template>
  <ContentReadingShell
    wide
    label="Contract de consum · Funcție permanentă"
    title="Retragere din contract."
    intro="Folosiți această funcție pentru a transmite o declarație neechivocă de retragere dintr-un contract de consum eligibil. Nu trebuie să indicați un motiv."
  >
    <template #meta>
      <ContentReadingMeta
        :items="[
          { label: 'Furnizor contractual', value: config.public.legalName || 'Neconfigurat' },
          { label: 'Confirmare', value: 'Confirmare datată prin e-mail' },
          { label: 'Limbă', value: 'Română' },
        ]"
      />
    </template>

    <div class="mb-10 flex flex-wrap items-center gap-4 border-b border-release-seam pb-6">
      <NuxtLink to="/withdrawal" class="release-action-secondary">English</NuxtLink>
      <p class="text-sm leading-6 text-release-paper-muted">
        Anularea reînnoirii din portalul de facturare este distinctă de exercitarea dreptului legal de retragere.
      </p>
    </div>

    <LegalWithdrawalForm
      locale="ro"
      :legal-name="config.public.legalName"
      :legal-address="config.public.legalAddress"
      :legal-email="config.public.legalEmail"
      :legal-registration-id="config.public.legalRegistrationId"
      :legal-tax-id="config.public.legalTaxId"
    />
  </ContentReadingShell>
</template>
