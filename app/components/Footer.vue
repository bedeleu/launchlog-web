<script setup lang="ts">
import { SITE_IDENTITY } from '#shared/constants/site-identity'
import { safeExternalHttpUrl } from '~/utils/safe-public-url'

const year = new Date().getFullYear()
const config = useRuntimeConfig()
const legalName = config.public.legalName.trim()
const { openPreferences } = usePrivacyConsent()
const statusPageUrl = safeExternalHttpUrl(config.public.statusPageUrl)
const socialLinks = [
  { label: 'X', href: SITE_IDENTITY.socialProfiles[3] },
  { label: 'LinkedIn', href: SITE_IDENTITY.socialProfiles[2] },
  { label: 'Instagram', href: SITE_IDENTITY.socialProfiles[1] },
  { label: 'Facebook', href: SITE_IDENTITY.socialProfiles[0] },
]

const columns = [
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
      { label: 'DMCA', to: '/dmca' },
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
</script>

<template>
  <footer class="mt-24 border-t border-release-seam bg-release-ink text-[#f6f1e7]">
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
            The log of what just shipped — structured for people, search engines, and AI discovery.
          </p>
          <a
            :href="`mailto:${SITE_IDENTITY.publicEmail}`"
            class="mt-6 inline-flex min-h-6 items-center font-mono text-xs uppercase tracking-[0.12em] text-release-blaze underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus"
          >
            {{ SITE_IDENTITY.publicEmail }}
          </a>
          <div class="mt-5 flex flex-wrap gap-x-5 gap-y-2" aria-label="LaunchLog social profiles">
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

      <div class="flex flex-col justify-between gap-3 pt-6 sm:flex-row sm:items-center">
        <p class="font-mono text-[11px] uppercase tracking-[0.1em] text-release-paper-muted">
          © {{ year }} LaunchLog.ai<span v-if="legalName"> · Operated by {{ legalName }}</span>
        </p>
        <div class="flex flex-wrap items-center gap-5">
          <button
            type="button"
            data-privacy-preferences-trigger
            class="inline-flex min-h-6 items-center font-mono text-[11px] uppercase tracking-[0.1em] text-release-paper-muted hover:text-[#f6f1e7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus"
            @click="openPreferences"
          >
            Privacy choices
          </button>
          <a
            v-if="statusPageUrl"
            :href="statusPageUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex min-h-6 items-center font-mono text-[11px] uppercase tracking-[0.1em] text-release-paper-muted hover:text-[#f6f1e7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus"
          >
            Service status ↗
          </a>
          <NuxtLink v-else to="/status" class="inline-flex min-h-6 items-center font-mono text-[11px] uppercase tracking-[0.1em] text-release-paper-muted hover:text-[#f6f1e7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus">
            Service status
          </NuxtLink>
        </div>
      </div>
    </div>
  </footer>
</template>
