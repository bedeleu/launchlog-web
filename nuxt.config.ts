import tailwindcss from '@tailwindcss/vite'
import { SITE_IDENTITY } from './shared/constants/site-identity'
import { assertProductionLegalIdentity } from './shared/utils/legal-readiness'
import { assertProductionAnalytics } from './shared/utils/analytics-readiness'

const formalLegalIdentity = {
  legalName: process.env.NUXT_PUBLIC_LEGAL_NAME,
  legalAddress: process.env.NUXT_PUBLIC_LEGAL_ADDRESS,
  legalRegistrationId: process.env.NUXT_PUBLIC_LEGAL_REGISTRATION_ID,
  legalTaxId: process.env.NUXT_PUBLIC_LEGAL_TAX_ID,
  legalPhone: process.env.NUXT_PUBLIC_LEGAL_PHONE,
  legalEmail: process.env.NUXT_PUBLIC_LEGAL_EMAIL,
  taxNoticeEn: process.env.NUXT_PUBLIC_TAX_NOTICE_EN,
  taxNoticeRo: process.env.NUXT_PUBLIC_TAX_NOTICE_RO,
}

const deploymentEnvironment = {
  NUXT_DEPLOY_ENVIRONMENT: process.env.NUXT_DEPLOY_ENVIRONMENT,
  RAILWAY_ENVIRONMENT_NAME: process.env.RAILWAY_ENVIRONMENT_NAME,
  VERCEL_ENV: process.env.VERCEL_ENV,
}

const plausibleConfig = {
  enabled: process.env.NUXT_PUBLIC_PLAUSIBLE_ENABLED === 'true',
  domain: process.env.NUXT_PUBLIC_PLAUSIBLE_DOMAIN || '',
  endpoint: process.env.NUXT_PUBLIC_PLAUSIBLE_ENDPOINT || '',
}

assertProductionLegalIdentity(deploymentEnvironment, formalLegalIdentity)
assertProductionAnalytics(deploymentEnvironment, {
  ...plausibleConfig,
  enabled: process.env.NUXT_PUBLIC_PLAUSIBLE_ENABLED,
  siteDomain: process.env.NUXT_PUBLIC_DOMAIN || 'launchlog.ai',
})

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-16',
  devtools: { enabled: true },
  experimental: {
    // Extracted payload URLs omit the query string, so cached directory pages
    // can hydrate page 2 with page 1 data. Keep query-specific SSR data inline.
    payloadExtraction: false,
  },
  // Tailwind v4 wired via the official Vite plugin (replaces the deprecated @nuxtjs/tailwindcss
  // legacy module which was pinned to Tailwind v3 and incompatible with shadcn-vue@2.7+).
  vite: {
    plugins: [tailwindcss()],
  },
  nitro: {
    // Railpack excludes Nitro's hidden dependency store from the runtime image.
    // Bundle runtime dependencies instead of exposing links into that store.
    externals: {
      inline: [() => true],
    },
  },
  css: ['~/assets/css/tailwind.css'],
  modules: [
    '@nuxtjs/sitemap',
    '@vueuse/nuxt',
    '@pinia/nuxt',
    '@nuxt/eslint',
  ],
  app: {
    head: {
      title: 'LaunchLog — The log of what just shipped',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'A curated directory for indie makers, SaaS founders, and tech launches, with structured product pages for people and machine-readable discovery.',
        },
      ],
    },
  },
  runtimeConfig: {
    public: {
      // Host only (no /api prefix). Callers must include /api/v1/... themselves — see
      // server/middleware/markdown-negotiation.ts for the canonical pattern.
      apiUrl: process.env.NUXT_PUBLIC_API_URL || 'https://api.launchlog.ai',
      domain: process.env.NUXT_PUBLIC_DOMAIN || 'launchlog.ai',
      operatorBrand: SITE_IDENTITY.operatorName,
      // Formal provider facts must match registration, Stripe and invoices. Empty
      // values stay empty so the application never invents a legal identity.
      legalName: formalLegalIdentity.legalName || '',
      legalAddress: formalLegalIdentity.legalAddress || '',
      legalRegistrationId: formalLegalIdentity.legalRegistrationId || '',
      legalTaxId: formalLegalIdentity.legalTaxId || '',
      legalPhone: formalLegalIdentity.legalPhone || '',
      legalEmail: formalLegalIdentity.legalEmail || '',
      supportEmail: process.env.NUXT_PUBLIC_SUPPORT_EMAIL || '',
      dmcaEmail: process.env.NUXT_PUBLIC_DMCA_EMAIL || '',
      statusPageUrl: process.env.NUXT_PUBLIC_STATUS_PAGE_URL || '',
      // Accountant-approved tax wording is configured independently per locale.
      // Empty renders nothing: a fallback here would guess either tax treatment
      // or a legal translation.
      taxNoticeEn: formalLegalIdentity.taxNoticeEn || '',
      taxNoticeRo: formalLegalIdentity.taxNoticeRo || '',
      firebase: {
        // 6 fields — no measurementId (D-032 — Plausible, not GA4).
        // storageBucket/messagingSenderId/appId kept for future App Check + headers, harmless if unused.
        apiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID,
      },
      plausibleEnabled: plausibleConfig.enabled,
      plausibleDomain: plausibleConfig.domain,
      // Exact self-hosted Plausible Events API endpoint. No vendor script runs
      // in the browser; an empty value keeps analytics disabled.
      plausibleEndpoint: plausibleConfig.endpoint,
      wordpressBlogUrl: process.env.NUXT_PUBLIC_WORDPRESS_BLOG_URL || 'https://blog.launchlog.ai',
    },
  },
  routeRules: {
    '/': { isr: 600 },
    '/browse-all': { isr: 1800 },
    '/tech-products': { isr: 1800 },
    '/featured': { isr: 3600 },
    '/sponsors': { redirect: '/featured' },
    '/pricing': { isr: 86400 },
    '/blog': { isr: 3600 },
    '/blog/**': { isr: 3600 },
    '/about': { isr: 86400 },
    // Firebase auth state exists only in the browser. Rendering protected pages
    // on the server makes the client redirect replace different HTML mid-hydration.
    '/dashboard': { ssr: false, headers: { 'x-robots-tag': 'noindex, nofollow' } },
    '/admin': { ssr: false, headers: { 'x-robots-tag': 'noindex, nofollow' } },
    '/admin/**': { ssr: false, headers: { 'x-robots-tag': 'noindex, nofollow' } },
    // Private/non-indexable routes are kept out of the sitemap via `sitemap.exclude`
    // below (the canonical @nuxtjs/sitemap API) — no per-route `sitemap: false`
    // rules here, which aren't typed on NitroRouteConfig.
  },
  router: {
    options: {
      // Exact-case route matching. Without it every page answers 200 under any casing, so
      // /Admin, /Listing/<slug> and friends were live duplicates of their canonical lowercase URL,
      // each emitting a self-referential canonical. Nuxt <4.5.1 additionally dropped route rules
      // for mixed-case paths (GHSA-hxvh-4h3w-prp9), so /Admin lost its noindex header too.
      // Dynamic parameter values keep their own casing; only the static route segments are matched.
      sensitive: true,
    },
  },
  components: {
    // Exclude shadcn-vue barrel files (app/components/ui/<name>/index.ts) from auto-import.
    // Without this, Nuxt registers both Foo.vue AND index.ts (which re-exports the same component),
    // emitting "Two component files resolving to the same name" warnings on every build.
    dirs: [
      { path: '~/components', extensions: ['vue'] },
    ],
  },
  site: {
    url: 'https://launchlog.ai',
    name: 'LaunchLog',
  },
  sitemap: {
    exclude: [
      '/admin',
      '/admin/**',
      '/dashboard',
      '/login',
      '/checkout/**',
      '/preview/**',
      '/contact',
      '/cookies',
      '/dmca',
      '/help',
      '/api-docs',
      '/privacy',
      '/terms',
      '/withdrawal',
      '/ro/privacy',
      '/ro/terms',
      '/ro/cookies',
      '/ro/retragere',
      '/status',
    ],
    sources: [
      '/api/__sitemap__/blog-urls',
      '/api/__sitemap__/listing-urls',
      '/api/__sitemap__/directory-pages',
    ],
  },
})
