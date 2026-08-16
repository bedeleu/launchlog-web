<script setup lang="ts">
import { safeExternalHttpUrl } from '~/utils/safe-public-url'

const year = new Date().getFullYear()
const config = useRuntimeConfig()
const legalName = config.public.legalName.trim()
const statusPageUrl = safeExternalHttpUrl(config.public.statusPageUrl)

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
  <footer class="mt-24 border-t border-brand-border bg-brand-bg">
    <div class="mx-auto max-w-7xl px-4 py-14">
      <!-- Brand + columns -->
      <div class="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div class="max-w-xs">
          <NuxtLink to="/" class="flex items-center gap-2.5">
            <img src="/images/logo.webp" alt="LaunchLog" width="32" height="32" class="size-8">
            <span class="text-lg font-bold tracking-tight text-brand-fg">
              LaunchLog<span class="text-brand-muted">.ai</span>
            </span>
          </NuxtLink>
          <p class="mt-3 text-sm text-brand-muted">
            The log of what just shipped — structured for people, search engines, and AI discovery.
          </p>
        </div>

        <div v-for="col in columns" :key="col.title">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-brand-muted">
            {{ col.title }}
          </h3>
          <ul class="mt-4 space-y-3">
            <li v-for="link in col.links" :key="link.to">
              <NuxtLink :to="link.to" class="text-sm text-brand-muted transition-colors hover:text-brand-fg">
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>

      <!-- Bottom bar -->
      <div class="mt-12 flex flex-col items-center justify-between gap-3 border-t border-brand-border pt-6 sm:flex-row">
        <p class="text-xs text-brand-muted">
          © {{ year }} LaunchLog.ai<span v-if="legalName"> · Operated by {{ legalName }}</span>
        </p>
        <a
          v-if="statusPageUrl"
          :href="statusPageUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-brand-muted transition-colors hover:text-brand-fg"
        >
          Service status ↗
        </a>
        <NuxtLink v-else to="/status" class="text-xs text-brand-muted transition-colors hover:text-brand-fg">
          Service status
        </NuxtLink>
      </div>
    </div>
  </footer>
</template>
