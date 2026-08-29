<script setup lang="ts">
import { SITE_IDENTITY } from '#shared/constants/site-identity'
import { safeExternalHttpUrl } from '~/utils/safe-public-url'

const year = new Date().getFullYear()
const config = useRuntimeConfig()
const route = useRoute()
const isRomanian = computed(() => route.path === '/ro' || route.path.startsWith('/ro/'))
const operatorBrand = config.public.operatorBrand.trim()
const { openPreferences } = usePrivacyConsent()
const statusPageUrl = safeExternalHttpUrl(config.public.statusPageUrl)
const socialLinks = [
  { label: 'X', href: SITE_IDENTITY.socialProfiles[3] },
  { label: 'LinkedIn', href: SITE_IDENTITY.socialProfiles[2] },
  { label: 'Instagram', href: SITE_IDENTITY.socialProfiles[1] },
  { label: 'Facebook', href: SITE_IDENTITY.socialProfiles[0] },
]

const englishColumns = [
  {
    title: 'Services',
    links: [
      { label: 'Browse Directory', to: '/browse-all' },
      { label: 'Tech Products', to: '/tech-products' },
      { label: 'Featured', to: '/featured' },
      { label: 'Submit a Product', to: '/submit' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', to: '/about' },
      { label: 'Contact', to: '/contact' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Blog', to: '/blog' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Terms of Service', to: '/terms' },
      { label: 'Cookie Policy', to: '/cookies' },
      { label: 'Copyright notices', to: '/dmca' },
      { label: 'Withdraw from contract here', to: '/withdrawal' },
      { label: 'Termeni în română', to: '/ro/terms' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'SEO Guide', to: '/seo-guide' },
      { label: 'Help Center', to: '/help' },
      { label: 'API Documentation', to: '/api-docs' },
      { label: 'Status Page', to: '/status' },
    ],
  },
]
const romanianColumns = [
  {
    title: 'Servicii',
    links: [
      { label: 'Răsfoiți directorul', to: '/browse-all' },
      { label: 'Produse tech', to: '/tech-products' },
      { label: 'Listări recomandate', to: '/featured' },
      { label: 'Înscrieți un produs', to: '/submit' },
    ],
  },
  {
    title: 'Companie',
    links: [
      { label: 'Despre noi', to: '/about' },
      { label: 'Contact', to: '/contact' },
      { label: 'Prețuri', to: '/pricing' },
      { label: 'Blog', to: '/blog' },
    ],
  },
  {
    title: 'Juridic',
    links: [
      { label: 'Politica de confidențialitate', to: '/ro/privacy' },
      { label: 'Termeni și condiții', to: '/ro/terms' },
      { label: 'Politica privind cookie-urile', to: '/ro/cookies' },
      { label: 'Notificări de copyright', to: '/dmca' },
      { label: 'Retragere din contract', to: '/ro/retragere' },
      { label: 'Terms in English', to: '/terms' },
    ],
  },
  {
    title: 'Resurse',
    links: [
      { label: 'Ghid SEO', to: '/seo-guide' },
      { label: 'Centru de ajutor', to: '/help' },
      { label: 'Documentație API', to: '/api-docs' },
      { label: 'Starea serviciului', to: '/status' },
    ],
  },
]
const columns = computed(() => isRomanian.value ? romanianColumns : englishColumns)
const footerCopy = computed(() => isRomanian.value
  ? {
      description: 'Registrul a ceea ce tocmai a fost lansat — structurat pentru oameni, motoare de căutare și descoperire prin AI.',
      social: 'Profilurile sociale LaunchLog',
      salLabel: 'Soluționare alternativă a litigiilor',
      operated: 'Operat de',
      privacy: 'Opțiuni de confidențialitate',
      status: 'Starea serviciului',
    }
  : {
      description: 'The log of what just shipped — structured for people, search engines, and AI discovery.',
      social: 'LaunchLog social profiles',
      salLabel: 'Alternative dispute resolution',
      operated: 'Operated by',
      privacy: 'Privacy choices',
      status: 'Service status',
    })
</script>

<template>
  <footer :lang="isRomanian ? 'ro' : 'en'" class="mt-24 border-t border-release-seam bg-release-ink text-[#f6f1e7]">
    <div class="h-1 bg-release-blaze" aria-hidden="true" />
    <div class="mx-auto max-w-7xl px-5 py-12 sm:px-8 md:py-16">
      <div class="grid border-y border-release-seam md:grid-cols-[1.25fr_2fr]">
        <div class="border-b border-release-seam py-8 md:border-r md:border-b-0 md:pr-10">
          <NuxtLink to="/" class="inline-flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus">
            <img src="/images/logo.webp" alt="LaunchLog" width="32" height="32" class="size-8">
            <span class="text-lg font-semibold tracking-[-0.025em]">
              LaunchLog<span class="text-release-paper-muted">.ai</span>
            </span>
          </NuxtLink>
          <p class="mt-5 max-w-sm text-base leading-7 text-release-paper-muted">
            {{ footerCopy.description }}
          </p>
          <a
            :href="`mailto:${SITE_IDENTITY.publicEmail}`"
            class="mt-6 inline-flex min-h-6 items-center font-mono text-xs uppercase tracking-[0.12em] text-release-blaze underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus"
          >
            {{ SITE_IDENTITY.publicEmail }}
          </a>
          <div class="mt-5 flex flex-wrap gap-x-5 gap-y-2" :aria-label="footerCopy.social">
            <a
              v-for="social in socialLinks"
              :key="social.href"
              :href="social.href"
              target="_blank"
              rel="noopener"
              class="inline-flex min-h-6 min-w-6 items-center justify-center font-mono text-[11px] uppercase tracking-[0.1em] text-release-paper-muted hover:text-[#f6f1e7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus"
            >
              {{ social.label }}
            </a>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4">
          <div
            v-for="col in columns"
            :key="col.title"
            class="border-release-seam px-4 py-8 odd:border-r sm:border-r sm:last:border-r-0"
          >
            <h3 class="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-release-blaze">
              {{ col.title }}
            </h3>
            <ul class="mt-5 space-y-3">
              <li v-for="link in col.links" :key="link.to">
                <NuxtLink
                  :to="link.to"
                  class="inline-flex min-h-6 items-center text-sm text-release-paper-muted hover:text-[#f6f1e7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus"
                >
                  {{ link.label }}
                </NuxtLink>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="mt-6 flex flex-col justify-between gap-4 border-t border-release-seam pt-6 lg:flex-row lg:items-center">
        <p class="font-mono text-[11px] uppercase tracking-[0.1em] text-release-paper-muted">
          © {{ year }} LaunchLog.ai<span v-if="operatorBrand"> · {{ footerCopy.operated }} {{ operatorBrand }}</span>
        </p>
        <a
          href="https://reclamatiisal.anpc.ro"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex min-h-6 w-fit items-center font-mono text-[11px] uppercase tracking-[0.1em] text-release-paper-muted hover:text-[#f6f1e7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus"
        >
          {{ footerCopy.salLabel }}
        </a>
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            data-privacy-preferences-trigger
            class="inline-flex min-h-6 items-center font-mono text-[11px] uppercase tracking-[0.1em] text-release-paper-muted hover:text-[#f6f1e7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus"
            @click="openPreferences"
          >
            {{ footerCopy.privacy }}
          </button>
          <a
            v-if="statusPageUrl"
            :href="statusPageUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex min-h-6 items-center font-mono text-[11px] uppercase tracking-[0.1em] text-release-paper-muted hover:text-[#f6f1e7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus"
          >
            {{ footerCopy.status }} ↗
          </a>
          <NuxtLink v-else to="/status" class="inline-flex min-h-6 items-center font-mono text-[11px] uppercase tracking-[0.1em] text-release-paper-muted hover:text-[#f6f1e7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus">
            {{ footerCopy.status }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </footer>
</template>
